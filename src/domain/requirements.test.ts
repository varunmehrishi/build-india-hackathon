import { describe, expect, it } from 'vitest'
import { createInitialAgreementState } from './demoData'
import { determineRequirements } from './requirements'

describe('determineRequirements', () => {
  it('translates the configured demo transaction into execution requirements', () => {
    const requirements = determineRequirements(createInitialAgreementState())

    expect(requirements).toEqual({
      stampDuty: { required: true, amount: 1800 },
      signatures: { required: true, parties: ['landlord', 'tenant'] },
      notarization: { required: false, optional: true },
      registration: { required: false },
    })
  })

  it('uses configured values instead of embedding the demo amount in the result', () => {
    const agreement = createInitialAgreementState()
    agreement.requirements = {
      stampDutyAmount: 2451,
      registrationRequired: true,
      notarizationOptional: false,
    }

    expect(determineRequirements(agreement)).toMatchObject({
      stampDuty: { required: true, amount: 2451 },
      notarization: { required: true, optional: false },
      registration: { required: true },
    })
  })

  it('marks a zero configured stamp amount as not required', () => {
    const agreement = createInitialAgreementState()
    agreement.requirements.stampDutyAmount = 0

    expect(determineRequirements(agreement).stampDuty).toEqual({ required: false, amount: 0 })
  })
})
