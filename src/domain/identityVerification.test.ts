import { describe, expect, it } from 'vitest'
import { createInitialAgreementState } from './demoData'
import {
  areBothPartiesVerified,
  clearExecutionVerification,
  isPartyVerifiedForVersion,
  verifyPartyForExecution,
} from './identityVerification'

function executionAgreement() {
  const agreement = createInitialAgreementState()
  agreement.finalized = true
  agreement.stampCompleted = true
  agreement.agreementVersion = 2
  return agreement
}

const evidence = { participantId: 'participant-demo', aadhaarLast4: '3333' }

describe('execution identity verification', () => {
  it('persists each party verification against the current agreement version', () => {
    let agreement = executionAgreement()
    agreement = verifyPartyForExecution(agreement, 'landlord', evidence, '2026-08-26T10:00:00.000Z')
    expect(isPartyVerifiedForVersion(agreement.landlord, 2)).toBe(true)
    expect(agreement.landlord.identityVerifiedAt).toBe('2026-08-26T10:00:00.000Z')
    expect(agreement.landlord.identityVerifiedParticipantId).toBe(evidence.participantId)
    expect(agreement.landlord.identityVerifiedAadhaarLast4).toBe('3333')
    expect(areBothPartiesVerified(agreement)).toBe(false)

    agreement = verifyPartyForExecution(agreement, 'tenant', evidence, '2026-08-26T10:01:00.000Z')
    expect(areBothPartiesVerified(agreement)).toBe(true)
  })

  it('does not verify an agreement before finalization and stamping', () => {
    const agreement = createInitialAgreementState()
    expect(verifyPartyForExecution(agreement, 'tenant', evidence)).toBe(agreement)
  })

  it('does not accept stale verification after a version change', () => {
    const agreement = verifyPartyForExecution(executionAgreement(), 'tenant', evidence)
    expect(isPartyVerifiedForVersion(agreement.tenant, 2)).toBe(true)
    expect(isPartyVerifiedForVersion(agreement.tenant, 3)).toBe(false)
    expect(clearExecutionVerification(agreement.tenant)).toMatchObject({ identityVerified: false })
  })
})
