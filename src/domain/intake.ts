import type {
  AgreementState,
  IntakeDraft,
  IntakeErrors,
  PropertyType,
} from './types'

export const indianStatesAndTerritories = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const

export const propertyTypeOptions: ReadonlyArray<{ value: PropertyType; label: string }> = [
  { value: 'residential-apartment', label: 'Residential apartment' },
  { value: 'independent-house', label: 'Independent house' },
  { value: 'builder-floor', label: 'Builder floor' },
  { value: 'other-residential', label: 'Other residential property' },
]

export const emptyIntakeDraft: IntakeDraft = {
  initiator: '',
  state: '',
  city: '',
  address: '',
  propertyType: '',
  monthlyRent: '',
  securityDeposit: '',
  durationMonths: '',
  startDate: '',
  landlordName: '',
  tenantName: '',
}

export const demoIntakeDraft: IntakeDraft = {
  initiator: 'tenant',
  state: 'Karnataka',
  city: 'Bengaluru',
  address: '24A, Lotus Heights, Indiranagar, Bengaluru',
  propertyType: 'residential-apartment',
  monthlyRent: '40000',
  securityDeposit: '120000',
  durationMonths: '11',
  startDate: '2026-09-01',
  landlordName: 'Arjun Rao',
  tenantName: 'Meera Sharma',
}

const rentIntentPattern = /\b(rent|rental|lease|tenancy|landlord|tenant)\b/i

export function classifyIntent(input: string): 'rent-agreement' | 'unsupported' {
  const normalized = input.trim().toLocaleLowerCase('en-IN')
  return rentIntentPattern.test(normalized) ? 'rent-agreement' : 'unsupported'
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function validateIntake(draft: IntakeDraft): IntakeErrors {
  const errors: IntakeErrors = {}
  const rent = Number(draft.monthlyRent)
  const deposit = Number(draft.securityDeposit)
  const duration = Number(draft.durationMonths)

  if (!draft.initiator) errors.initiator = 'Choose whether you are the landlord or tenant.'
  if (!draft.state) errors.state = 'Choose a state or union territory.'
  if (!draft.city.trim()) errors.city = 'Enter the property city.'
  if (!draft.address.trim()) errors.address = 'Enter the property address.'
  if (!draft.propertyType) errors.propertyType = 'Choose a residential property type.'
  if (!draft.monthlyRent || !Number.isFinite(rent) || rent <= 0) {
    errors.monthlyRent = 'Enter a monthly rent greater than zero.'
  }
  if (!draft.securityDeposit || !Number.isFinite(deposit) || deposit < 0) {
    errors.securityDeposit = 'Enter a security deposit of zero or more.'
  }
  if (!draft.durationMonths || !Number.isInteger(duration) || duration < 1 || duration > 60) {
    errors.durationMonths = 'Enter a duration between 1 and 60 months.'
  }
  if (!isValidIsoDate(draft.startDate)) {
    errors.startDate = 'Choose a valid start date.'
  }
  if (draft.landlordName.trim().length < 2) {
    errors.landlordName = 'Enter the landlord’s name.'
  }
  if (draft.tenantName.trim().length < 2) {
    errors.tenantName = 'Enter the tenant’s name.'
  }

  return errors
}

export function applyIntakeDraft(
  current: AgreementState,
  draft: IntakeDraft,
): AgreementState {
  return {
    ...current,
    initiator: draft.initiator || current.initiator,
    property: {
      address: draft.address.trim(),
      city: draft.city.trim(),
      state: draft.state,
      propertyType: draft.propertyType || current.property.propertyType,
    },
    monthlyRent: Number(draft.monthlyRent),
    securityDeposit: Number(draft.securityDeposit),
    durationMonths: Number(draft.durationMonths),
    startDate: draft.startDate,
    landlord: { ...current.landlord, name: draft.landlordName.trim() },
    tenant: { ...current.tenant, name: draft.tenantName.trim() },
    intakeCompleted: true,
    workflowStep: 'requirements',
  }
}

export function intakeDraftFromAgreement(state: AgreementState): IntakeDraft {
  return {
    initiator: state.initiator,
    state: state.property.state,
    city: state.property.city,
    address: state.property.address,
    propertyType: state.property.propertyType,
    monthlyRent: String(state.monthlyRent),
    securityDeposit: String(state.securityDeposit),
    durationMonths: String(state.durationMonths),
    startDate: state.startDate,
    landlordName: state.landlord.name,
    tenantName: state.tenant.name,
  }
}
