import { areBothPartiesVerified } from './identityVerification'
import { isNotarizationResolved } from './notarization'
import type {
  AgreementState,
  PartyRole,
  SignatureRecord,
  SigningEvent,
  SigningStatus,
} from './types'

interface CanonicalFinalAgreement {
  schema: 'saral-setu-final-agreement-v1'
  agreementId: string
  version: number
  parties: { landlord: string; tenant: string }
  clauses: Array<{ title: string; text: string }>
  inventory: Array<{
    name: string
    quantity: number
    condition: string
    notes: string
  }>
}

function signatureField(role: PartyRole): 'landlordSignature' | 'tenantSignature' {
  return role === 'landlord' ? 'landlordSignature' : 'tenantSignature'
}

function event(
  type: SigningEvent['type'],
  message: string,
  timestamp: string,
  actor?: PartyRole,
  index = 0,
): SigningEvent {
  return { id: `${type}-${timestamp}-${index}`, type, actor, timestamp, message }
}

export function finalAgreementVersion(agreement: AgreementState): number {
  return agreement.review?.finalizedVersion ?? agreement.agreementVersion
}

export function finalAgreementInventory(agreement: AgreementState) {
  const furnishing = agreement.agreementBuilder?.furnishing
  return furnishing && furnishing.level !== 'unfurnished' ? furnishing.inventory : []
}

export function serializeFinalAgreement(agreement: AgreementState): string {
  const canonical: CanonicalFinalAgreement = {
    schema: 'saral-setu-final-agreement-v1',
    agreementId: agreement.agreementId,
    version: finalAgreementVersion(agreement),
    parties: {
      landlord: agreement.landlord.name,
      tenant: agreement.tenant.name,
    },
    clauses: agreement.clauses.map(({ title, text }) => ({ title, text })),
    inventory: finalAgreementInventory(agreement).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      condition: item.condition,
      notes: item.notes,
    })),
  }
  return JSON.stringify(canonical)
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashAgreement(agreement: AgreementState): Promise<string> {
  return sha256(serializeFinalAgreement(agreement))
}

export function documentIdFromHash(hash: string): string {
  return hash.slice(0, 12).toUpperCase().match(/.{1,4}/g)?.join('-') ?? ''
}

export function canEnterSigning(agreement: AgreementState): boolean {
  return agreement.finalized &&
    agreement.stampCompleted &&
    areBothPartiesVerified(agreement) &&
    isNotarizationResolved(agreement)
}

export function resolveSigningStatus(agreement: AgreementState): SigningStatus {
  const count = Number(Boolean(agreement.landlordSignature)) + Number(Boolean(agreement.tenantSignature))
  return count === 2 ? 'complete' : count === 1 ? 'partially-signed' : 'not-started'
}

export function signatureMatchesFinalAgreement(
  agreement: AgreementState,
  signature?: SignatureRecord,
): boolean {
  return Boolean(
    signature &&
    agreement.finalDocumentHash &&
    signature.signedVersion === finalAgreementVersion(agreement) &&
    signature.signedDocumentHash === agreement.finalDocumentHash,
  )
}

export function areAllSignaturesComplete(agreement: AgreementState): boolean {
  return signatureMatchesFinalAgreement(agreement, agreement.landlordSignature) &&
    signatureMatchesFinalAgreement(agreement, agreement.tenantSignature)
}

export function hasAnySignature(agreement: AgreementState): boolean {
  return Boolean(agreement.landlordSignature || agreement.tenantSignature)
}

export async function prepareAgreementForSigning(
  agreement: AgreementState,
  timestamp = new Date().toISOString(),
): Promise<AgreementState> {
  if (!canEnterSigning(agreement)) return agreement
  const hash = await hashAgreement(agreement)
  if (agreement.finalDocumentHash) return agreement
  const signingEvents = agreement.signingEvents ?? []
  return {
    ...agreement,
    finalDocumentHash: hash,
    documentId: documentIdFromHash(hash),
    signingRole: agreement.signingRole ?? agreement.identityVerificationRole ?? agreement.initiator,
    signingStatus: resolveSigningStatus(agreement),
    signingEvents: [
      ...signingEvents,
      event('signing-started', `Final document prepared for signing as Version ${finalAgreementVersion(agreement)}`, timestamp, undefined, signingEvents.length),
    ],
  }
}

export async function isDocumentUnchanged(agreement: AgreementState): Promise<boolean> {
  if (!agreement.finalDocumentHash) return false
  return (await hashAgreement(agreement)) === agreement.finalDocumentHash
}

export async function recordSignature(
  agreement: AgreementState,
  role: PartyRole,
  timestamp = new Date().toISOString(),
): Promise<AgreementState> {
  if (!canEnterSigning(agreement) || !agreement.finalDocumentHash || !agreement.documentId) return agreement
  const currentHash = await hashAgreement(agreement)
  if (currentHash !== agreement.finalDocumentHash) return agreement

  const otherRole: PartyRole = role === 'landlord' ? 'tenant' : 'landlord'
  const otherSignature = agreement[signatureField(otherRole)]
  if (otherSignature && !signatureMatchesFinalAgreement(agreement, otherSignature)) return agreement
  if (agreement[signatureField(role)]) return agreement

  const signature: SignatureRecord = {
    signerRole: role,
    signerName: agreement[role].name,
    signedVersion: finalAgreementVersion(agreement),
    signedDocumentHash: agreement.finalDocumentHash,
    signedAt: timestamp,
    signatureReference: `SIG-DEMO-${agreement.finalDocumentHash.slice(role === 'tenant' ? 12 : 20, role === 'tenant' ? 16 : 24).toUpperCase()}`,
  }
  const signingEvents = agreement.signingEvents ?? []
  const withSignature: AgreementState = {
    ...agreement,
    [role]: { ...agreement[role], signed: true },
    [signatureField(role)]: signature,
    signingStatus: otherSignature ? 'complete' : 'partially-signed',
    signingEvents: [
      ...signingEvents,
      event('signature-completed', `${signature.signerName} signed Version ${signature.signedVersion}`, timestamp, role, signingEvents.length),
    ],
  }
  if (!otherSignature) return withSignature
  return {
    ...withSignature,
    signingEvents: [
      ...(withSignature.signingEvents ?? []),
      event('all-signatures-completed', 'All required signatures completed', timestamp, undefined, (withSignature.signingEvents ?? []).length),
    ],
  }
}

export function recordSignatureCancellation(
  agreement: AgreementState,
  role: PartyRole,
  timestamp = new Date().toISOString(),
): AgreementState {
  if (agreement[signatureField(role)]) return agreement
  const signingEvents = agreement.signingEvents ?? []
  return {
    ...agreement,
    signingEvents: [
      ...signingEvents,
      event('signature-cancelled', `${agreement[role].name} cancelled the signing attempt`, timestamp, role, signingEvents.length),
    ],
  }
}
