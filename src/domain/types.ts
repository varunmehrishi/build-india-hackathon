export type WorkflowStep =
  | 'intent'
  | 'details'
  | 'requirements'
  | 'agreement'
  | 'review'
  | 'finalized'
  | 'stamp'
  | 'identity'
  | 'notary'
  | 'sign'
  | 'complete'

export interface Party {
  id: 'landlord' | 'tenant'
  name: string
  identityVerified: boolean
  approvedAgreement: boolean
  signed: boolean
}

export interface PropertyDetails {
  address: string
  city: string
  state: string
  propertyType: PropertyType
}

export type PropertyType =
  | 'residential-apartment'
  | 'independent-house'
  | 'builder-floor'
  | 'other-residential'

export interface Clause {
  id: string
  title: string
  text: string
  previousText?: string
  status?: 'unchanged' | 'proposed' | 'accepted' | 'rejected'
}

export interface AgreementState {
  workflowStep: WorkflowStep
  intentText: string
  intakeCompleted: boolean
  initiator: 'landlord' | 'tenant'
  property: PropertyDetails
  monthlyRent: number
  securityDeposit: number
  durationMonths: number
  startDate: string
  landlord: Party
  tenant: Party
  clauses: Clause[]
  requirements: {
    stampDutyAmount: number
    registrationRequired: boolean
    notarizationOptional: boolean
  }
  agreementVersion: number
  finalized: boolean
  stampCompleted: boolean
  notarized: boolean
}

export interface IntakeDraft {
  initiator: '' | AgreementState['initiator']
  state: string
  city: string
  address: string
  propertyType: '' | PropertyType
  monthlyRent: string
  securityDeposit: string
  durationMonths: string
  startDate: string
  landlordName: string
  tenantName: string
}

export type IntakeField = keyof IntakeDraft
export type IntakeErrors = Partial<Record<IntakeField, string>>

export interface WorkflowStepConfig {
  id: WorkflowStep
  title: string
  kicker: string
  description: string
  placeholderPoints: readonly string[]
}
