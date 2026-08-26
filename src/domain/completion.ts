import { areBothPartiesVerified } from './identityVerification'
import { isNotarizationResolved, resolveNotarizationStatus } from './notarization'
import { createTextPdf, downloadBlob } from './pdf'
import {
  finalAgreementInventory,
  finalAgreementVersion,
  isDocumentUnchanged,
  signatureMatchesFinalAgreement,
} from './signing'
import { stampDutyPaymentFor } from './stampDuty'
import type { AgreementState, PartyRole } from './types'

export interface CompletionSummary {
  complete: boolean
  documentId: string
  finalizedVersion: number
  completedAt?: string
  landlordSigned: boolean
  tenantSigned: boolean
  stampCompleted: boolean
  identitiesVerified: boolean
  notarizationStatus: 'completed' | 'skipped' | 'incomplete'
}

export interface AuditEntry {
  id: string
  timestamp: string
  message: string
  actor?: PartyRole
}

export function deriveCompletionSummary(agreement: AgreementState): CompletionSummary {
  const landlordSigned = signatureMatchesFinalAgreement(agreement, agreement.landlordSignature)
  const tenantSigned = signatureMatchesFinalAgreement(agreement, agreement.tenantSignature)
  const identitiesVerified = areBothPartiesVerified(agreement)
  const notary = resolveNotarizationStatus(agreement)
  const notarizationStatus = notary === 'completed'
    ? 'completed'
    : notary === 'skipped'
      ? 'skipped'
      : 'incomplete'
  const signedTimes = [agreement.landlordSignature?.signedAt, agreement.tenantSignature?.signedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
  const complete = Boolean(
    agreement.finalized &&
    agreement.stampCompleted &&
    identitiesVerified &&
    isNotarizationResolved(agreement) &&
    landlordSigned &&
    tenantSigned &&
    agreement.finalDocumentHash &&
    agreement.documentId,
  )
  return {
    complete,
    documentId: agreement.documentId ?? '',
    finalizedVersion: finalAgreementVersion(agreement),
    completedAt: signedTimes.at(-1),
    landlordSigned,
    tenantSigned,
    stampCompleted: agreement.stampCompleted,
    identitiesVerified,
    notarizationStatus,
  }
}

export function buildAuditTrail(agreement: AgreementState): AuditEntry[] {
  const events: AuditEntry[] = [
    ...(agreement.review?.events ?? []).map(({ id, timestamp, message, actor }) => ({ id, timestamp, message, actor })),
    ...(agreement.signingEvents ?? []).map(({ id, timestamp, message, actor }) => ({ id, timestamp, message, actor })),
  ]
  const stamp = agreement.stampDutyPayment
  for (const role of ['landlord', 'tenant'] as const) {
    const contribution = stamp?.[role]
    if (contribution?.status === 'paid' && contribution.paidAt) {
      events.push({
        id: `stamp-${role}-${contribution.paidAt}`,
        timestamp: contribution.paidAt,
        actor: role,
        message: `${agreement[role].name} completed their stamp duty contribution`,
      })
    }
  }
  for (const role of ['landlord', 'tenant'] as const) {
    const party = agreement[role]
    if (party.identityVerified && party.identityVerifiedAt) {
      events.push({
        id: `identity-${role}-${party.identityVerifiedAt}`,
        timestamp: party.identityVerifiedAt,
        actor: role,
        message: `${party.name}'s identity was verified for Version ${party.identityVerifiedVersion}`,
      })
    }
  }
  if (agreement.notarizationCompletedAt) {
    events.push({
      id: `notary-${agreement.notarizationCompletedAt}`,
      timestamp: agreement.notarizationCompletedAt,
      message: `Notarial attestation completed by ${agreement.notaryDisplayName ?? 'the demo notary'}`,
    })
  }
  return events.sort((left, right) => left.timestamp.localeCompare(right.timestamp))
}

function formatDateTime(timestamp?: string): string {
  if (!timestamp) return 'Not recorded'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(timestamp))
}

function signatureLines(agreement: AgreementState, role: PartyRole): string[] {
  const signature = role === 'landlord' ? agreement.landlordSignature : agreement.tenantSignature
  return [
    role.toUpperCase(),
    agreement[role].name,
    signatureMatchesFinalAgreement(agreement, signature) ? 'Digitally signed - Demo eSign' : 'Signature missing',
    `Signed: ${formatDateTime(signature?.signedAt)}`,
    `Signature reference: ${signature?.signatureReference ?? 'Not recorded'}`,
  ]
}

function stampLines(agreement: AgreementState): string[] {
  const payment = stampDutyPaymentFor(agreement)
  return [
    `Configured demo stamp duty: INR ${agreement.requirements.stampDutyAmount.toLocaleString('en-IN')}`,
    `Status: ${agreement.stampCompleted ? 'Completed' : 'Incomplete'}`,
    ...(['landlord', 'tenant'] as const).map((role) => {
      const contribution = payment[role]
      return `${agreement[role].name}: INR ${contribution.amount.toLocaleString('en-IN')} - ${contribution.status}${contribution.paymentReference ? ` - ${contribution.paymentReference}` : ''}`
    }),
  ]
}

export function buildSignedAgreementLines(agreement: AgreementState): string[] {
  const inventory = finalAgreementInventory(agreement)
  const notary = resolveNotarizationStatus(agreement)
  return [
    'SARAL SETU',
    'FINAL SIGNED AGREEMENT',
    '',
    'Residential Rent Agreement',
    `Version ${finalAgreementVersion(agreement)}`,
    `Document ID: ${agreement.documentId ?? 'Not prepared'}`,
    `Finalized: ${formatDateTime(agreement.finalizedAt)}`,
    '',
    `Property: ${agreement.property.address}, ${agreement.property.city}, ${agreement.property.state}`,
    `Landlord: ${agreement.landlord.name}`,
    `Tenant: ${agreement.tenant.name}`,
    `Term: ${agreement.durationMonths} months from ${agreement.startDate}`,
    `Monthly rent: INR ${agreement.monthlyRent.toLocaleString('en-IN')}`,
    `Security deposit: INR ${agreement.securityDeposit.toLocaleString('en-IN')}`,
    '',
    'AGREEMENT TERMS',
    ...agreement.clauses.flatMap((clause, index) => ['', `${index + 1}. ${clause.title}`, clause.text]),
    ...(inventory.length ? [
      '',
      'SCHEDULE A - FURNISHINGS, FIXTURES AND INVENTORY',
      ...inventory.map((item) => `${item.name} | Qty ${item.quantity} | ${item.condition}${item.notes ? ` | ${item.notes}` : ''}`),
    ] : []),
    '',
    'DEMO E-STAMP RECORD',
    ...stampLines(agreement),
    '',
    'NOTARIAL ATTESTATION',
    notary === 'completed'
      ? `Completed by ${agreement.notaryDisplayName} (${agreement.notaryRegistrationId}) on ${formatDateTime(agreement.notarizationCompletedAt)}`
      : 'Not selected for this agreement',
    '',
    'SIGNATURES',
    ...signatureLines(agreement, 'landlord'),
    '',
    ...signatureLines(agreement, 'tenant'),
    '',
    `Saral Setu Document ID: ${agreement.documentId ?? 'Not prepared'}`,
    `Final Version: ${finalAgreementVersion(agreement)}`,
    '',
    'Hackathon prototype. Demo stamp, identity, notary and eSign records are not government-issued certificates.',
  ]
}

export function buildExecutionRecordLines(agreement: AgreementState, integrity?: boolean): string[] {
  const summary = deriveCompletionSummary(agreement)
  const notary = resolveNotarizationStatus(agreement)
  const audit = buildAuditTrail(agreement)
  return [
    'SARAL SETU EXECUTION RECORD',
    '',
    'DOCUMENT',
    'Residential Rent Agreement',
    `Document ID: ${summary.documentId}`,
    `Final Version: ${summary.finalizedVersion}`,
    `Completed: ${formatDateTime(summary.completedAt)}`,
    '',
    'PARTIES',
    `${agreement.landlord.name} - Landlord - Identity verified ${agreement.landlord.identityVerified ? 'yes' : 'no'} - Signed Version ${agreement.landlordSignature?.signedVersion ?? 'not signed'}`,
    `${agreement.tenant.name} - Tenant - Identity verified ${agreement.tenant.identityVerified ? 'yes' : 'no'} - Signed Version ${agreement.tenantSignature?.signedVersion ?? 'not signed'}`,
    '',
    'EXECUTION',
    `Agreement finalized: ${agreement.finalized ? 'yes' : 'no'}`,
    `Stamp duty completed: ${agreement.stampCompleted ? 'yes' : 'no'}`,
    `Notarial attestation: ${notary === 'completed' ? 'completed' : notary === 'skipped' ? 'not selected' : 'incomplete'}`,
    `Both parties signed: ${summary.landlordSigned && summary.tenantSigned ? 'yes' : 'no'}`,
    `Current document matches signed copy: ${integrity === true ? 'yes' : integrity === false ? 'no' : 'not checked'}`,
    '',
    'DOCUMENT INTEGRITY',
    `SHA-256: ${agreement.finalDocumentHash ?? 'Not prepared'}`,
    '',
    'AUDIT TRAIL',
    ...audit.map((event) => `${formatDateTime(event.timestamp)} - ${event.message}`),
    '',
    'This execution record summarizes the Saral Setu hackathon demo. It is not a government certificate.',
  ]
}

export function downloadSignedAgreement(agreement: AgreementState): void {
  downloadBlob(createTextPdf(buildSignedAgreementLines(agreement)), 'Saral-Setu-Rent-Agreement.pdf')
}

export async function downloadExecutionRecord(agreement: AgreementState): Promise<void> {
  const integrity = await isDocumentUnchanged(agreement)
  downloadBlob(createTextPdf(buildExecutionRecordLines(agreement, integrity)), 'Saral-Setu-Execution-Record.pdf')
}

export function demoEmailForParty(name: string, role: PartyRole): string {
  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${firstName || role}@example.com`
}
