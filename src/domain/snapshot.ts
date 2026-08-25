import { Unzlib, zlibSync } from 'fflate'
import { isAgreementBuilderConfiguration } from './agreementBuilder'
import type { AgreementReviewState, AgreementState, PartyRole, StampDutyContribution, WorkflowStep } from './types'

export const SNAPSHOT_FRAGMENT_KEY = 'share'
export const MAX_ENCODED_SNAPSHOT_LENGTH = 64 * 1024
export const MAX_DECODED_SNAPSHOT_LENGTH = 256 * 1024

const validSteps = new Set<WorkflowStep>([
  'intent', 'details', 'requirements', 'agreement', 'review', 'finalized',
  'stamp', 'identity', 'notary', 'sign', 'complete',
])
const validPropertyTypes = new Set([
  'residential-apartment', 'independent-house', 'builder-floor', 'other-residential',
])

export interface WorkflowSnapshotEnvelope {
  codecVersion: 1
  agreement: AgreementState
  furthestStepIndex: number
  invitedRole?: PartyRole
  documentName?: string
  documentNameCustomized?: boolean
}

export type SnapshotDecodeResult =
  | { ok: true; snapshot: WorkflowSnapshotEnvelope }
  | { ok: false; error: string }

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url characters')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function boundedUnzlib(compressed: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = []
  let decodedLength = 0
  const decompressor = new Unzlib((chunk) => {
    decodedLength += chunk.byteLength
    if (decodedLength > MAX_DECODED_SNAPSHOT_LENGTH) {
      throw new Error('Decoded snapshot exceeds the safe size limit')
    }
    chunks.push(chunk)
  })
  decompressor.push(compressed, true)

  const decoded = new Uint8Array(decodedLength)
  let offset = 0
  for (const chunk of chunks) {
    decoded.set(chunk, offset)
    offset += chunk.byteLength
  }
  return decoded
}

function isPartyRole(value: unknown): value is PartyRole {
  return value === 'landlord' || value === 'tenant'
}

function isParty(value: unknown, role: PartyRole): boolean {
  if (!value || typeof value !== 'object') return false
  const party = value as Record<string, unknown>
  return (
    party.id === role &&
    typeof party.name === 'string' &&
    (party.participantId === undefined || typeof party.participantId === 'string') &&
    typeof party.identityVerified === 'boolean' &&
    typeof party.approvedAgreement === 'boolean' &&
    typeof party.signed === 'boolean'
  )
}

function isClause(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const clause = value as Record<string, unknown>
  return typeof clause.id === 'string' && typeof clause.title === 'string' && typeof clause.text === 'string'
}

function isReviewState(value: unknown): value is AgreementReviewState {
  if (!value || typeof value !== 'object') return false
  const review = value as Record<string, unknown>
  const proposals = review.proposals
  const events = review.events
  return (
    isPartyRole(review.currentRole) &&
    (review.selectedClauseId === undefined || typeof review.selectedClauseId === 'string') &&
    Array.isArray(proposals) && proposals.every((value) => {
      if (!value || typeof value !== 'object') return false
      const proposal = value as Record<string, unknown>
      const structuredChange = proposal.structuredChange
      return typeof proposal.id === 'string' && typeof proposal.clauseId === 'string' &&
        isPartyRole(proposal.proposedBy) && typeof proposal.oldText === 'string' &&
        typeof proposal.newText === 'string' && typeof proposal.summary === 'string' &&
        typeof proposal.reason === 'string' && ['pending', 'accepted', 'rejected'].includes(String(proposal.status)) &&
        typeof proposal.createdAt === 'string' &&
        (proposal.resolvedAt === undefined || typeof proposal.resolvedAt === 'string') &&
        (proposal.resolvedBy === undefined || isPartyRole(proposal.resolvedBy)) &&
        (structuredChange === undefined || (
          !!structuredChange && typeof structuredChange === 'object' &&
          (structuredChange as Record<string, unknown>).field === 'deposit.refundDays' &&
          typeof (structuredChange as Record<string, unknown>).value === 'number'
        ))
    }) &&
    Array.isArray(events) && events.every((value) => {
      if (!value || typeof value !== 'object') return false
      const event = value as Record<string, unknown>
      return typeof event.id === 'string' && typeof event.type === 'string' &&
        ['proposal-created', 'proposal-accepted', 'proposal-rejected', 'agreement-updated', 'party-approved', 'agreement-finalized'].includes(event.type) &&
        (event.actor === undefined || isPartyRole(event.actor)) && typeof event.timestamp === 'string' && typeof event.message === 'string'
    }) &&
    (review.landlordApprovedVersion === undefined || typeof review.landlordApprovedVersion === 'number') &&
    (review.tenantApprovedVersion === undefined || typeof review.tenantApprovedVersion === 'number') &&
    (review.finalizedVersion === undefined || typeof review.finalizedVersion === 'number')
  )
}

function isStampContribution(value: unknown): value is StampDutyContribution {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<StampDutyContribution>
  return (
    typeof item.percentage === 'number' &&
    Number.isInteger(item.percentage) &&
    item.percentage >= 0 &&
    item.percentage <= 100 &&
    typeof item.amount === 'number' &&
    Number.isInteger(item.amount) &&
    item.amount >= 0 &&
    (item.status === 'not-required' || item.status === 'pending' || item.status === 'paid') &&
    (item.paymentReference === undefined || typeof item.paymentReference === 'string') &&
    (item.paidAt === undefined || typeof item.paidAt === 'string')
  )
}

function isStampDutyPayment(value: unknown, totalAmount: number): boolean {
  if (!value || typeof value !== 'object') return false
  const payment = value as Record<string, unknown>
  const landlord = payment.landlord as StampDutyContribution | undefined
  const tenant = payment.tenant as StampDutyContribution | undefined
  return (
    isStampContribution(landlord) &&
    isStampContribution(tenant) &&
    landlord.percentage + tenant.percentage === 100 &&
    landlord.amount === Math.ceil(totalAmount * landlord.percentage / 100) &&
    tenant.amount === totalAmount - landlord.amount &&
    (landlord.status === 'not-required') === (landlord.amount === 0) &&
    (tenant.status === 'not-required') === (tenant.amount === 0) &&
    (landlord.status !== 'paid' || (!!landlord.paymentReference && !!landlord.paidAt)) &&
    (tenant.status !== 'paid' || (!!tenant.paymentReference && !!tenant.paidAt)) &&
    (payment.configuredBy === undefined || isPartyRole(payment.configuredBy)) &&
    typeof payment.locked === 'boolean'
  )
}

export function isAgreementState(value: unknown): value is AgreementState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<AgreementState>
  return (
    typeof state.agreementId === 'string' &&
    state.agreementId.length > 0 &&
    typeof state.snapshotRevision === 'number' &&
    Number.isInteger(state.snapshotRevision) &&
    state.snapshotRevision >= 0 &&
    typeof state.workflowStep === 'string' &&
    validSteps.has(state.workflowStep as WorkflowStep) &&
    typeof state.intentText === 'string' &&
    typeof state.intakeCompleted === 'boolean' &&
    isPartyRole(state.initiator) &&
    !!state.property &&
    typeof state.property.address === 'string' &&
    typeof state.property.city === 'string' &&
    typeof state.property.state === 'string' &&
    typeof state.property.propertyType === 'string' &&
    validPropertyTypes.has(state.property.propertyType) &&
    typeof state.monthlyRent === 'number' &&
    typeof state.securityDeposit === 'number' &&
    typeof state.durationMonths === 'number' &&
    typeof state.startDate === 'string' &&
    isParty(state.landlord, 'landlord') &&
    isParty(state.tenant, 'tenant') &&
    Array.isArray(state.clauses) &&
    state.clauses.every(isClause) &&
    (state.agreementBuilder === undefined || isAgreementBuilderConfiguration(state.agreementBuilder)) &&
    (state.review === undefined || isReviewState(state.review)) &&
    !!state.requirements &&
    typeof state.requirements.stampDutyAmount === 'number' &&
    typeof state.requirements.registrationRequired === 'boolean' &&
    typeof state.requirements.notarizationOptional === 'boolean' &&
    typeof state.agreementVersion === 'number' &&
    typeof state.finalized === 'boolean' &&
    (state.finalizedBy === undefined || isPartyRole(state.finalizedBy)) &&
    (state.finalizedAt === undefined || typeof state.finalizedAt === 'string') &&
    (state.stampDutyPayment === undefined || isStampDutyPayment(state.stampDutyPayment, state.requirements.stampDutyAmount)) &&
    typeof state.stampCompleted === 'boolean' &&
    typeof state.notarized === 'boolean' &&
    (state.lastUpdatedBy === undefined || isPartyRole(state.lastUpdatedBy))
  )
}

function isSnapshot(value: unknown): value is WorkflowSnapshotEnvelope {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<WorkflowSnapshotEnvelope>
  return (
    snapshot.codecVersion === 1 &&
    isAgreementState(snapshot.agreement) &&
    typeof snapshot.furthestStepIndex === 'number' &&
    Number.isInteger(snapshot.furthestStepIndex) &&
    snapshot.furthestStepIndex >= 0 &&
    snapshot.furthestStepIndex <= 10 &&
    (snapshot.invitedRole === undefined || isPartyRole(snapshot.invitedRole)) &&
    (snapshot.documentName === undefined || typeof snapshot.documentName === 'string') &&
    (snapshot.documentNameCustomized === undefined || typeof snapshot.documentNameCustomized === 'boolean')
  )
}

export function encodeSnapshot(snapshot: WorkflowSnapshotEnvelope): string {
  const encoded = new TextEncoder().encode(JSON.stringify(snapshot))
  if (encoded.byteLength > MAX_DECODED_SNAPSHOT_LENGTH) {
    throw new Error('This agreement is too large to share in a URL.')
  }
  const result = bytesToBase64Url(zlibSync(encoded, { level: 9 }))
  if (result.length > MAX_ENCODED_SNAPSHOT_LENGTH) {
    throw new Error('This agreement is too large to share in a URL.')
  }
  return result
}

export function decodeSnapshot(encoded: string): SnapshotDecodeResult {
  if (!encoded || encoded.length > MAX_ENCODED_SNAPSHOT_LENGTH) {
    return { ok: false, error: 'The shared agreement link is empty or too large.' }
  }
  try {
    const decoded = boundedUnzlib(base64UrlToBytes(encoded))
    const value: unknown = JSON.parse(new TextDecoder().decode(decoded))
    if (!isSnapshot(value)) {
      return { ok: false, error: 'This shared agreement uses an invalid or unsupported format.' }
    }
    return { ok: true, snapshot: value }
  } catch {
    return { ok: false, error: 'This shared agreement link is damaged or incomplete.' }
  }
}

export function snapshotFromLocation(hash = window.location.hash): SnapshotDecodeResult | null {
  const parameters = new URLSearchParams(hash.replace(/^#/, ''))
  const encoded = parameters.get(SNAPSHOT_FRAGMENT_KEY)
  return encoded ? decodeSnapshot(encoded) : null
}

export function createSnapshotUrl(snapshot: WorkflowSnapshotEnvelope): string {
  const url = new URL(window.location.href)
  url.hash = `${SNAPSHOT_FRAGMENT_KEY}=${encodeSnapshot(snapshot)}`
  return url.toString()
}

export function replaceSnapshotUrl(snapshot: WorkflowSnapshotEnvelope | null): void {
  const url = new URL(window.location.href)
  url.hash = snapshot ? `${SNAPSHOT_FRAGMENT_KEY}=${encodeSnapshot(snapshot)}` : ''
  window.history.replaceState(null, '', url)
}
