import { Unzlib, zlibSync } from 'fflate'
import { isAgreementBuilderConfiguration } from './agreementBuilder'
import type { AgreementReviewState, AgreementState, PartyRole, SignatureRecord, SigningEvent, StampDutyContribution, WorkflowStep } from './types'

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
    (party.identityVerifiedVersion === undefined || (
      typeof party.identityVerifiedVersion === 'number' && Number.isInteger(party.identityVerifiedVersion) && party.identityVerifiedVersion > 0
    )) &&
    (party.identityVerifiedAt === undefined || typeof party.identityVerifiedAt === 'string') &&
    (party.identityVerifiedParticipantId === undefined || typeof party.identityVerifiedParticipantId === 'string') &&
    (party.identityVerifiedAadhaarLast4 === undefined || (typeof party.identityVerifiedAadhaarLast4 === 'string' && /^\d{4}$/.test(party.identityVerifiedAadhaarLast4))) &&
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

function isSignatureRecord(value: unknown): value is SignatureRecord {
  if (!value || typeof value !== 'object') return false
  const signature = value as Record<string, unknown>
  return isPartyRole(signature.signerRole) &&
    typeof signature.signerName === 'string' &&
    typeof signature.signedVersion === 'number' && Number.isInteger(signature.signedVersion) && signature.signedVersion > 0 &&
    typeof signature.signedDocumentHash === 'string' && /^[a-f0-9]{64}$/.test(signature.signedDocumentHash) &&
    typeof signature.signedAt === 'string' &&
    typeof signature.signatureReference === 'string'
}

function isSigningEvent(value: unknown): value is SigningEvent {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' &&
    ['signing-started', 'signature-completed', 'signature-cancelled', 'all-signatures-completed'].includes(String(item.type)) &&
    (item.actor === undefined || isPartyRole(item.actor)) &&
    typeof item.timestamp === 'string' &&
    typeof item.message === 'string'
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
    (state.identityVerificationRole === undefined || isPartyRole(state.identityVerificationRole)) &&
    !!state.requirements &&
    typeof state.requirements.stampDutyAmount === 'number' &&
    typeof state.requirements.registrationRequired === 'boolean' &&
    typeof state.requirements.notarizationOptional === 'boolean' &&
    typeof state.agreementVersion === 'number' && Number.isInteger(state.agreementVersion) && state.agreementVersion > 0 &&
    typeof state.finalized === 'boolean' &&
    (state.finalizedBy === undefined || isPartyRole(state.finalizedBy)) &&
    (state.finalizedAt === undefined || typeof state.finalizedAt === 'string') &&
    (state.stampDutyPayment === undefined || isStampDutyPayment(state.stampDutyPayment, state.requirements.stampDutyAmount)) &&
    typeof state.stampCompleted === 'boolean' &&
    (state.notarizationStatus === undefined || ['not_started', 'skipped', 'completed'].includes(state.notarizationStatus)) &&
    (state.notaryDisplayName === undefined || typeof state.notaryDisplayName === 'string') &&
    (state.notaryRegistrationId === undefined || typeof state.notaryRegistrationId === 'string') &&
    (state.notarizationCompletedAt === undefined || typeof state.notarizationCompletedAt === 'string') &&
    (state.notarizedAgreementVersion === undefined || (
      typeof state.notarizedAgreementVersion === 'number' && Number.isInteger(state.notarizedAgreementVersion) && state.notarizedAgreementVersion > 0
    )) &&
    typeof state.notarized === 'boolean' &&
    (state.finalDocumentHash === undefined || (typeof state.finalDocumentHash === 'string' && /^[a-f0-9]{64}$/.test(state.finalDocumentHash))) &&
    (state.documentId === undefined || (typeof state.documentId === 'string' && /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(state.documentId))) &&
    (state.signingRole === undefined || isPartyRole(state.signingRole)) &&
    (state.landlordSignature === undefined || isSignatureRecord(state.landlordSignature)) &&
    (state.tenantSignature === undefined || isSignatureRecord(state.tenantSignature)) &&
    (state.signingStatus === undefined || ['not-started', 'partially-signed', 'complete'].includes(state.signingStatus)) &&
    (state.signingEvents === undefined || (Array.isArray(state.signingEvents) && state.signingEvents.every(isSigningEvent))) &&
    (state.lastUpdatedBy === undefined || isPartyRole(state.lastUpdatedBy)) &&
    hasConsistentAgreementState(state as AgreementState)
  )
}

function contributionComplete(status: StampDutyContribution['status']): boolean {
  return status === 'paid' || status === 'not-required'
}

function verifiedPartyIsConsistent(agreement: AgreementState, role: PartyRole): boolean {
  const party = agreement[role]
  if (!party.identityVerified) {
    return party.identityVerifiedVersion === undefined && party.identityVerifiedAt === undefined &&
      party.identityVerifiedParticipantId === undefined && party.identityVerifiedAadhaarLast4 === undefined
  }
  if (party.identityVerifiedVersion !== agreement.agreementVersion || !party.identityVerifiedAt) return false
  const hasEvidence = party.identityVerifiedParticipantId !== undefined || party.identityVerifiedAadhaarLast4 !== undefined
  if (!hasEvidence) return true // Accept snapshots created before participant evidence was added.
  return Boolean(
    party.participantId &&
    party.identityVerifiedParticipantId === party.participantId &&
    party.identityVerifiedAadhaarLast4,
  )
}

function signatureIsConsistent(agreement: AgreementState, role: PartyRole): boolean {
  const signature = role === 'landlord' ? agreement.landlordSignature : agreement.tenantSignature
  if (!signature) return !agreement[role].signed
  return Boolean(
    agreement[role].signed &&
    agreement.finalDocumentHash &&
    agreement.documentId &&
    signature.signerRole === role &&
    signature.signerName === agreement[role].name &&
    signature.signedVersion === agreement.agreementVersion &&
    signature.signedDocumentHash === agreement.finalDocumentHash,
  )
}

function hasConsistentAgreementState(agreement: AgreementState): boolean {
  const stepIndex = [...validSteps].indexOf(agreement.workflowStep)
  const finalizedIndex = [...validSteps].indexOf('finalized')
  const identityIndex = [...validSteps].indexOf('identity')
  const notaryIndex = [...validSteps].indexOf('notary')
  const signIndex = [...validSteps].indexOf('sign')
  const completeIndex = [...validSteps].indexOf('complete')
  const finalizedVersion = agreement.review?.finalizedVersion

  if (agreement.finalized) {
    if (!agreement.finalizedAt || finalizedVersion !== agreement.agreementVersion || !agreement.review ||
      agreement.review.proposals.some((proposal) => proposal.status === 'pending') ||
      agreement.review.landlordApprovedVersion !== agreement.agreementVersion ||
      agreement.review.tenantApprovedVersion !== agreement.agreementVersion ||
      !agreement.landlord.approvedAgreement || !agreement.tenant.approvedAgreement) return false
  } else if (agreement.finalizedAt || agreement.finalizedBy || finalizedVersion !== undefined || stepIndex >= finalizedIndex) {
    return false
  }

  const paymentComplete = agreement.stampDutyPayment
    ? contributionComplete(agreement.stampDutyPayment.landlord.status) && contributionComplete(agreement.stampDutyPayment.tenant.status)
    : false
  if (agreement.stampCompleted !== paymentComplete) return false
  if (stepIndex >= identityIndex && !agreement.stampCompleted) return false
  if (!verifiedPartyIsConsistent(agreement, 'landlord') || !verifiedPartyIsConsistent(agreement, 'tenant')) return false
  const bothVerified = agreement.landlord.identityVerified && agreement.tenant.identityVerified
  if (stepIndex >= notaryIndex && !bothVerified) return false

  if (agreement.notarizationStatus === 'skipped' && !agreement.requirements.notarizationOptional) return false
  if (agreement.notarizationStatus === 'completed') {
    if (!agreement.notarized || agreement.notarizedAgreementVersion !== agreement.agreementVersion ||
      !agreement.notaryDisplayName || !agreement.notaryRegistrationId || !agreement.notarizationCompletedAt) return false
  } else if (agreement.notarized || agreement.notarizedAgreementVersion || agreement.notarizationCompletedAt) {
    return false
  }
  if (stepIndex >= signIndex) {
    const resolved = agreement.notarizationStatus === 'completed' ||
      (agreement.notarizationStatus === 'skipped' && agreement.requirements.notarizationOptional)
    if (!resolved) return false
  }

  if (!signatureIsConsistent(agreement, 'landlord') || !signatureIsConsistent(agreement, 'tenant')) return false
  const signatureCount = Number(Boolean(agreement.landlordSignature)) + Number(Boolean(agreement.tenantSignature))
  const expectedSigningStatus = signatureCount === 2 ? 'complete' : signatureCount === 1 ? 'partially-signed' : 'not-started'
  if (agreement.signingStatus !== undefined && agreement.signingStatus !== expectedSigningStatus) return false
  if (agreement.finalDocumentHash) {
    const expectedDocumentId = agreement.finalDocumentHash.slice(0, 12).toUpperCase().match(/.{1,4}/g)?.join('-')
    if (agreement.documentId !== expectedDocumentId || stepIndex < signIndex) return false
  } else if (agreement.documentId || signatureCount) return false
  if (signatureCount && stepIndex < signIndex) return false
  if (stepIndex >= completeIndex && signatureCount !== 2) return false
  return true
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
    snapshot.furthestStepIndex >= workflowIndex(snapshot.agreement.workflowStep) &&
    (snapshot.invitedRole === undefined || isPartyRole(snapshot.invitedRole)) &&
    (snapshot.documentName === undefined || typeof snapshot.documentName === 'string') &&
    (snapshot.documentNameCustomized === undefined || typeof snapshot.documentNameCustomized === 'boolean')
  )
}

function workflowIndex(step: WorkflowStep): number {
  return [...validSteps].indexOf(step)
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
