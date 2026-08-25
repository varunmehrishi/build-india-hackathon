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

export type PartyRole = 'landlord' | 'tenant'

export type StampContributionStatus = 'not-required' | 'pending' | 'paid'

export interface StampDutyContribution {
  percentage: number
  amount: number
  status: StampContributionStatus
  paymentReference?: string
  paidAt?: string
}

export interface StampDutyPaymentState {
  landlord: StampDutyContribution
  tenant: StampDutyContribution
  configuredBy?: PartyRole
  locked: boolean
}

export interface Party {
  id: 'landlord' | 'tenant'
  name: string
  participantId?: string
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

export type ProposalStatus = 'pending' | 'accepted' | 'rejected'

export interface ProposedChange {
  id: string
  clauseId: string
  proposedBy: PartyRole
  oldText: string
  newText: string
  summary: string
  reason: string
  status: ProposalStatus
  createdAt: string
  resolvedAt?: string
  resolvedBy?: PartyRole
  structuredChange?: {
    field: 'deposit.refundDays'
    value: number
  }
}

export type ReviewEventType =
  | 'proposal-created'
  | 'proposal-accepted'
  | 'proposal-rejected'
  | 'agreement-updated'
  | 'party-approved'
  | 'agreement-finalized'

export interface ReviewEvent {
  id: string
  type: ReviewEventType
  actor?: PartyRole
  timestamp: string
  message: string
}

export interface AgreementReviewState {
  currentRole: PartyRole
  selectedClauseId?: string
  proposals: ProposedChange[]
  landlordApprovedVersion?: number
  tenantApprovedVersion?: number
  finalizedVersion?: number
  events: ReviewEvent[]
}

export type ClauseImportance = 'essential' | 'recommended' | 'optional'
export type FurnishingLevel = 'unfurnished' | 'semi-furnished' | 'fully-furnished'
export type ResponsibleParty = 'landlord' | 'tenant' | 'included'
export type InventoryCondition = 'New' | 'Good' | 'Fair' | 'Existing damage' | 'Not checked'

export interface InventoryItem {
  id: string
  category: 'Furniture' | 'Major appliances' | 'Kitchen appliances' | 'Kitchenware' | 'Fixtures & fittings' | 'Electronics & smart devices' | 'Keys & access'
  name: string
  quantity: number
  condition: InventoryCondition
  notes: string
  brand?: string
  model?: string
}

export interface AgreementBuilderConfiguration {
  rent: {
    dueDay: number
    paymentModes: string[]
    latePaymentEnabled: boolean
    graceDays: number
    latePaymentConsequence: string
    escalationEnabled: boolean
    escalationPercent: number
    escalationAfterMonths: number
  }
  deposit: {
    refundDays: number
    deductions: string[]
  }
  term: {
    noticeEnabled: boolean
    noticePeriod: string
    lockInEnabled: boolean
    lockInMonths: number
    lockInAppliesTo: 'both parties' | 'tenant' | 'landlord'
    renewalEnabled: boolean
    renewalType: 'mutual written agreement' | 'automatic renewal'
    earlyTerminationEnabled: boolean
    earlyTerminationReasons: string[]
  }
  maintenance: {
    enabled: boolean
    regularChargesPaidBy: ResponsibleParty
    majorAssessmentsPaidBy: Exclude<ResponsibleParty, 'included'>
  }
  utilities: {
    enabled: boolean
    items: Array<{ name: string; enabled: boolean; paidBy: Exclude<ResponsibleParty, 'included'> }>
  }
  repairs: {
    enabled: boolean
    tenantResponsibilities: string[]
    landlordResponsibilities: string[]
  }
  usage: {
    enabled: boolean
    workFromHome: boolean
    sublettingEnabled: boolean
    subletting: 'written consent required' | 'allowed'
    alterationsEnabled: boolean
  }
  occupancy: {
    enabled: boolean
    occupants: Array<{ id: string; name: string; relationship: string }>
    guestConditionsEnabled: boolean
    guestConditions: string
    petsEnabled: boolean
    pets: 'allowed' | 'allowed with conditions' | 'not permitted'
    petConditions: string
  }
  access: {
    enabled: boolean
    noticeHours: number
    emergencyException: boolean
  }
  parking: {
    enabled: boolean
    type: 'car' | 'two-wheeler' | 'both'
    identifier: string
  }
  restoration: {
    enabled: boolean
    type: 'same condition' | 'agreed painting cost' | 'custom'
    customText: string
  }
  furnishing: {
    level: FurnishingLevel
    inventory: InventoryItem[]
  }
  meterReadings: {
    enabled: boolean
    electricity: string
    water: string
    gas: string
  }
  customTerms: Array<{ id: string; text: string }>
}

export interface AgreementState {
  agreementId: string
  snapshotRevision: number
  lastUpdatedBy?: PartyRole
  workflowStep: WorkflowStep
  intentText: string
  intakeCompleted: boolean
  initiator: PartyRole
  property: PropertyDetails
  monthlyRent: number
  securityDeposit: number
  durationMonths: number
  startDate: string
  landlord: Party
  tenant: Party
  clauses: Clause[]
  agreementBuilder?: AgreementBuilderConfiguration
  review?: AgreementReviewState
  requirements: {
    stampDutyAmount: number
    registrationRequired: boolean
    notarizationOptional: boolean
  }
  agreementVersion: number
  finalized: boolean
  finalizedBy?: PartyRole
  finalizedAt?: string
  stampDutyPayment?: StampDutyPaymentState
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
  documentName: string
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
