import type { AgreementState, Party, PartyRole } from './types'

export function isPartyVerifiedForVersion(party: Party, agreementVersion: number): boolean {
  return party.identityVerified && party.identityVerifiedVersion === agreementVersion
}

export function areBothPartiesVerified(agreement: AgreementState): boolean {
  return isPartyVerifiedForVersion(agreement.landlord, agreement.agreementVersion) &&
    isPartyVerifiedForVersion(agreement.tenant, agreement.agreementVersion)
}

export function verifyPartyForExecution(
  agreement: AgreementState,
  role: PartyRole,
  timestamp = new Date().toISOString(),
): AgreementState {
  if (!agreement.finalized || !agreement.stampCompleted) return agreement
  return {
    ...agreement,
    [role]: {
      ...agreement[role],
      identityVerified: true,
      identityVerifiedVersion: agreement.agreementVersion,
      identityVerifiedAt: timestamp,
    },
  }
}

export function clearExecutionVerification(party: Party): Party {
  return {
    ...party,
    identityVerified: false,
    identityVerifiedVersion: undefined,
    identityVerifiedAt: undefined,
  }
}
