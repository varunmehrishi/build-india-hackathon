import type { AgreementState, WorkflowStepConfig } from './types'

function createAgreementId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `agreement-${Date.now()}`
}

export const workflowSteps: readonly WorkflowStepConfig[] = [
  {
    id: 'intent',
    title: 'Intent',
    kicker: 'Start here',
    description: 'Capture the plain-language request and route to the rent-agreement journey.',
    placeholderPoints: [
      'Natural-language input for a citizen-friendly start.',
      'Deterministic route into the one supported workflow.',
      'No LLM or free-form legal generation.',
    ],
  },
  {
    id: 'details',
    title: 'Guided details',
    kicker: 'Intake',
    description: 'Collect only the tenancy details needed for the demo transaction.',
    placeholderPoints: [
      'Landlord or tenant role.',
      'Property location, rent, deposit, duration, and start date.',
      'Synthetic party names and a fictional demo address.',
    ],
  },
  {
    id: 'requirements',
    title: 'Requirements',
    kicker: 'Magic screen',
    description: 'Explain the steps that apply to this exact demo scenario.',
    placeholderPoints: [
      'Stamp duty status with a demo amount from config.',
      'Clear statement that registration is not required for this scenario.',
      'A calm summary before document generation.',
    ],
  },
  {
    id: 'agreement',
    title: 'Agreement',
    kicker: 'Template output',
    description: 'Render the controlled rent-agreement template in a readable document view.',
    placeholderPoints: [
      'Structured sections for parties, term, rent, deposit, and signatures.',
      'No free-form legal text generation.',
      'Readable on mobile and desktop.',
    ],
  },
  {
    id: 'review',
    title: 'Review',
    kicker: 'Collaborate',
    description: 'Show the landlord and tenant review flow with a placeholder negotiation loop.',
    placeholderPoints: [
      'Clause-level review panel.',
      'Deposit refund proposal flow.',
      'Accept and reject states for the demo.',
    ],
  },
  {
    id: 'finalized',
    title: 'Finalized',
    kicker: 'Lock the document',
    description: 'Display versioning, approvals, and a locked state.',
    placeholderPoints: [
      'Agreement version tracking.',
      'Approval statuses for both parties.',
      'Document hash or evidence placeholder.',
    ],
  },
  {
    id: 'stamp',
    title: 'Stamp duty',
    kicker: 'Execution step',
    description: 'Reserve space for the simulated payment and e-stamp flow.',
    placeholderPoints: [
      'Demo stamp duty amount.',
      'Payment and success states.',
      'Clearly marked sample e-stamp preview.',
    ],
  },
  {
    id: 'identity',
    title: 'Identity',
    kicker: 'Verification',
    description: 'Verify both people signing the finalized agreement with the local Aadhaar OTP simulation.',
    placeholderPoints: [
      'Separate version-aware status for landlord and tenant.',
      'Deterministic role switching and OTP verification.',
      'No real KYC or biometric processing.',
    ],
  },
  {
    id: 'notary',
    title: 'Notary',
    kicker: 'Optional',
    description: 'Leave room for the optional attestation choice and simulated meeting room.',
    placeholderPoints: [
      'Add notarisation or skip.',
      'Static notary profile for the demo.',
      'No real conferencing or credentials.',
    ],
  },
  {
    id: 'sign',
    title: 'eSign',
    kicker: 'Sign and seal',
    description: 'Prepare a believable signing flow for both parties.',
    placeholderPoints: [
      'Apply a simulated signature state.',
      'Sequential signing for landlord and tenant.',
      'Success feedback without external providers.',
    ],
  },
  {
    id: 'complete',
    title: 'Completion',
    kicker: 'Payoff',
    description: 'End with a success screen, audit trail, and export actions.',
    placeholderPoints: [
      'Final checklist of completed steps.',
      'Audit trail and share/download affordances.',
      'Reset demo control to restart instantly.',
    ],
  },
] as const

export const workflowStepOrder = workflowSteps.map((step) => step.id)

export function createInitialAgreementState(): AgreementState {
  return {
    agreementId: createAgreementId(),
    snapshotRevision: 0,
    workflowStep: 'intent',
    intentText: '',
    intakeCompleted: false,
    initiator: 'tenant',
    property: {
      address: '',
      city: '',
      state: '',
      propertyType: 'residential-apartment',
    },
    monthlyRent: 0,
    securityDeposit: 0,
    durationMonths: 0,
    startDate: '',
    landlord: {
      id: 'landlord',
      name: '',
      identityVerified: false,
      approvedAgreement: false,
      signed: false,
    },
    tenant: {
      id: 'tenant',
      name: '',
      identityVerified: false,
      approvedAgreement: false,
      signed: false,
    },
    clauses: [
      {
        id: 'rent',
        title: 'Rent',
        text: 'The tenant shall pay a monthly rent of INR 40,000 on or before the 5th day of each month.',
        status: 'unchanged',
      },
      {
        id: 'deposit-refund',
        title: 'Deposit refund',
        text: 'The security deposit shall be refunded within 30 days of the tenant vacating the premises, subject to deductions for unpaid rent or damages.',
        status: 'unchanged',
      },
      {
        id: 'maintenance',
        title: 'Maintenance',
        text: 'The tenant shall keep the premises reasonably clean and notify the landlord of major repairs promptly.',
        status: 'unchanged',
      },
    ],
    requirements: {
      stampDutyAmount: 1800,
      registrationRequired: false,
      notarizationOptional: true,
    },
    agreementVersion: 1,
    finalized: false,
    stampCompleted: false,
    notarizationStatus: 'not_started',
    notarized: false,
  }
}
