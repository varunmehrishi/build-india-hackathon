import { describe, expect, it } from 'vitest'
import { createInitialAgreementState } from './demoData'
import { verifyPartyForExecution } from './identityVerification'
import {
  attestAgreement,
  DEMO_NOTARY,
  isNotarizationResolved,
  resolveNotarizationStatus,
  skipNotarization,
} from './notarization'

function verifiedAgreement() {
  let agreement = createInitialAgreementState()
  agreement = { ...agreement, finalized: true, stampCompleted: true, agreementVersion: 2 }
  agreement = verifyPartyForExecution(agreement, 'landlord')
  return verifyPartyForExecution(agreement, 'tenant')
}

describe('notarisation', () => {
  it('persists a skipped decision as a resolved checkpoint', () => {
    const agreement = skipNotarization(verifiedAgreement())
    expect(resolveNotarizationStatus(agreement)).toBe('skipped')
    expect(agreement.notarized).toBe(false)
    expect(isNotarizationResolved(agreement)).toBe(true)
  })

  it('records demo notary evidence against the current agreement version', () => {
    const agreement = attestAgreement(verifiedAgreement(), '2026-08-26T14:44:00.000Z')
    expect(agreement).toMatchObject({
      notarizationStatus: 'completed',
      notarized: true,
      notaryDisplayName: DEMO_NOTARY.displayName,
      notaryRegistrationId: DEMO_NOTARY.registrationId,
      notarizationCompletedAt: '2026-08-26T14:44:00.000Z',
      notarizedAgreementVersion: 2,
    })
    expect(isNotarizationResolved(agreement)).toBe(true)
  })

  it('blocks attestation without both current-version identity verifications', () => {
    const agreement = verifiedAgreement()
    agreement.tenant.identityVerifiedVersion = 1
    expect(attestAgreement(agreement)).toBe(agreement)
    expect(skipNotarization(agreement)).toBe(agreement)
  })

  it('does not treat completed evidence as valid after a version change', () => {
    const agreement = attestAgreement(verifiedAgreement())
    expect(isNotarizationResolved({ ...agreement, agreementVersion: 3 })).toBe(false)
  })
})
