import type { AgreementState, PartyRole } from './types'

export interface AgreementRequirements {
  stampDuty: {
    required: boolean
    amount: number
  }
  signatures: {
    required: boolean
    parties: PartyRole[]
  }
  notarization: {
    required: boolean
    optional: boolean
  }
  registration: {
    required: boolean
  }
}

export function determineRequirements(agreement: AgreementState): AgreementRequirements {
  return {
    stampDuty: {
      required: agreement.requirements.stampDutyAmount > 0,
      amount: agreement.requirements.stampDutyAmount,
    },
    signatures: {
      required: true,
      parties: ['landlord', 'tenant'],
    },
    notarization: {
      required: !agreement.requirements.notarizationOptional,
      optional: agreement.requirements.notarizationOptional,
    },
    registration: {
      required: agreement.requirements.registrationRequired,
    },
  }
}
