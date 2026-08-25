import { areBothPartiesVerified } from './identityVerification'
import type { AgreementState, NotarizationStatus } from './types'

export const DEMO_NOTARY = {
  displayName: 'Adv. A. Sharma',
  title: 'Notary Public',
  registrationId: 'DEMO-001',
} as const

export function resolveNotarizationStatus(agreement: AgreementState): NotarizationStatus {
  if (agreement.notarizationStatus === 'skipped') return 'skipped'
  if (
    (agreement.notarizationStatus === 'completed' || agreement.notarized) &&
    agreement.notarized &&
    agreement.notarizedAgreementVersion === agreement.agreementVersion
  ) return 'completed'
  return 'not_started'
}

export function isNotarizationResolved(agreement: AgreementState): boolean {
  const status = resolveNotarizationStatus(agreement)
  return status === 'skipped' || (
    status === 'completed' &&
    agreement.notarized &&
    agreement.notarizedAgreementVersion === agreement.agreementVersion
  )
}

export function skipNotarization(agreement: AgreementState): AgreementState {
  if (!areBothPartiesVerified(agreement) || !agreement.finalized || !agreement.stampCompleted) return agreement
  return {
    ...agreement,
    notarizationStatus: 'skipped',
    notarized: false,
    notaryDisplayName: undefined,
    notaryRegistrationId: undefined,
    notarizationCompletedAt: undefined,
    notarizedAgreementVersion: undefined,
  }
}

export function attestAgreement(
  agreement: AgreementState,
  timestamp = new Date().toISOString(),
): AgreementState {
  if (!areBothPartiesVerified(agreement) || !agreement.finalized || !agreement.stampCompleted) return agreement
  return {
    ...agreement,
    notarizationStatus: 'completed',
    notarized: true,
    notaryDisplayName: DEMO_NOTARY.displayName,
    notaryRegistrationId: DEMO_NOTARY.registrationId,
    notarizationCompletedAt: timestamp,
    notarizedAgreementVersion: agreement.agreementVersion,
  }
}
