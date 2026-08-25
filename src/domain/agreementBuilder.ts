import type {
  AgreementBuilderConfiguration,
  AgreementState,
  Clause,
  FurnishingLevel,
  InventoryItem,
} from './types'

export interface GeneratedAgreement {
  title: string
  clauses: Clause[]
  inventory: InventoryItem[]
  optionalClauseCount: number
}

const demoInventory: InventoryItem[] = [
  inventory('wardrobe', 'Furniture', 'Wardrobe', 2),
  inventory('ceiling-fan', 'Fixtures & fittings', 'Ceiling fan', 4),
  inventory('geyser', 'Major appliances', 'Geyser / water heater', 2),
  inventory('air-conditioner', 'Major appliances', 'Air conditioner', 2),
  inventory('modular-kitchen', 'Fixtures & fittings', 'Modular kitchen', 1),
  inventory('chimney', 'Kitchen appliances', 'Chimney', 1),
  inventory('gas-stove', 'Kitchen appliances', 'Gas stove', 1),
]

function inventory(
  id: string,
  category: InventoryItem['category'],
  name: string,
  quantity: number,
): InventoryItem {
  return { id, category, name, quantity, condition: 'Good', notes: '' }
}

export function createDefaultAgreementBuilderConfiguration(): AgreementBuilderConfiguration {
  return {
    rent: {
      dueDay: 5,
      paymentModes: ['Bank transfer / UPI'],
      latePaymentEnabled: true,
      graceDays: 5,
      latePaymentConsequence: 'The parties will discuss and resolve the delay promptly.',
      escalationEnabled: false,
      escalationPercent: 5,
      escalationAfterMonths: 11,
    },
    deposit: {
      refundDays: 30,
      deductions: ['Unpaid rent', 'Outstanding utility bills', 'Damage beyond normal wear and tear'],
    },
    term: {
      noticeEnabled: true,
      noticePeriod: '1 month',
      lockInEnabled: false,
      lockInMonths: 6,
      lockInAppliesTo: 'both parties',
      renewalEnabled: false,
      renewalType: 'mutual written agreement',
      earlyTerminationEnabled: true,
      earlyTerminationReasons: ['Non-payment of rent', 'Material breach of agreement', 'Illegal use of premises'],
    },
    maintenance: { enabled: true, regularChargesPaidBy: 'tenant', majorAssessmentsPaidBy: 'landlord' },
    utilities: {
      enabled: true,
      items: [
        { name: 'Electricity', enabled: true, paidBy: 'tenant' },
        { name: 'Water', enabled: true, paidBy: 'tenant' },
        { name: 'Piped gas', enabled: true, paidBy: 'tenant' },
        { name: 'Internet', enabled: true, paidBy: 'tenant' },
        { name: 'DTH / Cable', enabled: false, paidBy: 'tenant' },
        { name: 'Society charges', enabled: true, paidBy: 'tenant' },
        { name: 'Property tax', enabled: true, paidBy: 'landlord' },
      ],
    },
    repairs: {
      enabled: true,
      tenantResponsibilities: ['routine upkeep', 'minor consumables', 'damage caused by the tenant or occupants', 'damage beyond normal wear and tear'],
      landlordResponsibilities: ['structural repairs', 'major plumbing or electrical defects not caused by the tenant'],
    },
    usage: {
      enabled: true,
      workFromHome: false,
      sublettingEnabled: true,
      subletting: 'written consent required',
      alterationsEnabled: true,
    },
    occupancy: {
      enabled: false,
      occupants: [],
      guestConditionsEnabled: false,
      guestConditions: '',
      petsEnabled: false,
      pets: 'allowed with conditions',
      petConditions: '',
    },
    access: { enabled: true, noticeHours: 24, emergencyException: true },
    parking: { enabled: false, type: 'car', identifier: '' },
    restoration: { enabled: false, type: 'same condition', customText: '' },
    furnishing: { level: 'semi-furnished', inventory: demoInventory.map((item) => ({ ...item })) },
    meterReadings: { enabled: false, electricity: '', water: '', gas: '' },
    customTerms: [],
  }
}

export function resolveAgreementBuilderConfiguration(agreement: AgreementState): AgreementBuilderConfiguration {
  return agreement.agreementBuilder ?? createDefaultAgreementBuilderConfiguration()
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isAgreementBuilderConfiguration(value: unknown): value is AgreementBuilderConfiguration {
  const configuration = record(value)
  if (!configuration) return false
  const rent = record(configuration.rent)
  const deposit = record(configuration.deposit)
  const term = record(configuration.term)
  const maintenance = record(configuration.maintenance)
  const utilities = record(configuration.utilities)
  const repairs = record(configuration.repairs)
  const usage = record(configuration.usage)
  const occupancy = record(configuration.occupancy)
  const access = record(configuration.access)
  const parking = record(configuration.parking)
  const restoration = record(configuration.restoration)
  const furnishing = record(configuration.furnishing)
  const meterReadings = record(configuration.meterReadings)
  if (!rent || !deposit || !term || !maintenance || !utilities || !repairs || !usage || !occupancy || !access || !parking || !restoration || !furnishing || !meterReadings) return false

  const paymentModesValid = stringArray(rent.paymentModes)
  const utilitiesValid = Array.isArray(utilities.items) && utilities.items.every((value) => {
    const item = record(value)
    return item && typeof item.name === 'string' && typeof item.enabled === 'boolean' && (item.paidBy === 'landlord' || item.paidBy === 'tenant')
  })
  const occupantsValid = Array.isArray(occupancy.occupants) && occupancy.occupants.every((value) => {
    const item = record(value)
    return item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.relationship === 'string'
  })
  const inventoryValid = Array.isArray(furnishing.inventory) && furnishing.inventory.every((value) => {
    const item = record(value)
    return item && typeof item.id === 'string' && typeof item.category === 'string' && typeof item.name === 'string' && finiteNumber(item.quantity) && typeof item.condition === 'string' && typeof item.notes === 'string'
  })
  const customTermsValid = Array.isArray(configuration.customTerms) && configuration.customTerms.every((value) => {
    const item = record(value)
    return item && typeof item.id === 'string' && typeof item.text === 'string'
  })

  return Boolean(
    finiteNumber(rent.dueDay) && paymentModesValid && typeof rent.latePaymentEnabled === 'boolean' &&
    finiteNumber(rent.graceDays) && typeof rent.latePaymentConsequence === 'string' &&
    typeof rent.escalationEnabled === 'boolean' && finiteNumber(rent.escalationPercent) && finiteNumber(rent.escalationAfterMonths) &&
    finiteNumber(deposit.refundDays) && stringArray(deposit.deductions) &&
    typeof term.noticeEnabled === 'boolean' && typeof term.noticePeriod === 'string' && typeof term.lockInEnabled === 'boolean' &&
    finiteNumber(term.lockInMonths) && ['both parties', 'tenant', 'landlord'].includes(String(term.lockInAppliesTo)) &&
    typeof term.renewalEnabled === 'boolean' && ['mutual written agreement', 'automatic renewal'].includes(String(term.renewalType)) &&
    typeof term.earlyTerminationEnabled === 'boolean' && stringArray(term.earlyTerminationReasons) &&
    typeof maintenance.enabled === 'boolean' && ['landlord', 'tenant', 'included'].includes(String(maintenance.regularChargesPaidBy)) &&
    ['landlord', 'tenant'].includes(String(maintenance.majorAssessmentsPaidBy)) &&
    typeof utilities.enabled === 'boolean' && utilitiesValid &&
    typeof repairs.enabled === 'boolean' && stringArray(repairs.tenantResponsibilities) && stringArray(repairs.landlordResponsibilities) &&
    typeof usage.enabled === 'boolean' && typeof usage.workFromHome === 'boolean' && typeof usage.sublettingEnabled === 'boolean' &&
    ['written consent required', 'allowed'].includes(String(usage.subletting)) && typeof usage.alterationsEnabled === 'boolean' &&
    typeof occupancy.enabled === 'boolean' && occupantsValid && typeof occupancy.guestConditionsEnabled === 'boolean' &&
    typeof occupancy.guestConditions === 'string' && typeof occupancy.petsEnabled === 'boolean' &&
    ['allowed', 'allowed with conditions', 'not permitted'].includes(String(occupancy.pets)) && typeof occupancy.petConditions === 'string' &&
    typeof access.enabled === 'boolean' && finiteNumber(access.noticeHours) && typeof access.emergencyException === 'boolean' &&
    typeof parking.enabled === 'boolean' && ['car', 'two-wheeler', 'both'].includes(String(parking.type)) && typeof parking.identifier === 'string' &&
    typeof restoration.enabled === 'boolean' && ['same condition', 'agreed painting cost', 'custom'].includes(String(restoration.type)) && typeof restoration.customText === 'string' &&
    ['unfurnished', 'semi-furnished', 'fully-furnished'].includes(String(furnishing.level)) && inventoryValid &&
    typeof meterReadings.enabled === 'boolean' && typeof meterReadings.electricity === 'string' && typeof meterReadings.water === 'string' && typeof meterReadings.gas === 'string' &&
    customTermsValid
  )
}

function formatDate(value: string): string {
  if (!value) return 'the agreed commencement date'
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.valueOf())
    ? value
    : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed)
}

function inr(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}

function possessiveRole(role: string): string {
  return role === 'included' ? 'included in the monthly rent' : `paid by the ${role}`
}

function list(items: string[]): string {
  if (items.length < 2) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

export function generateAgreement(
  agreement: AgreementState,
  configuration = resolveAgreementBuilderConfiguration(agreement),
): GeneratedAgreement {
  const clauses: Clause[] = []
  const add = (id: string, title: string, text: string) => clauses.push({ id, title, text, status: 'unchanged' })
  const parkingDescription = configuration.parking.enabled
    ? ` Parking for ${configuration.parking.type === 'both' ? 'a car and a two-wheeler' : `a ${configuration.parking.type}`} is included${configuration.parking.identifier.trim() ? ` at ${configuration.parking.identifier.trim()}` : ''}.`
    : ''

  add('parties', 'Parties', `${agreement.landlord.name || 'The landlord'} (“Landlord”) and ${agreement.tenant.name || 'the tenant'} (“Tenant”) agree to the terms below.`)
  add('premises', 'Premises', `The Landlord provides the residential premises at ${agreement.property.address || 'the agreed property address'}, ${agreement.property.city}, ${agreement.property.state} to the Tenant.${parkingDescription}`)
  add('term', 'Term', `The tenancy begins on ${formatDate(agreement.startDate)} and continues for ${agreement.durationMonths} months.`)
  add('monthly-rent', 'Monthly Rent', `The Tenant will pay monthly rent of ${inr(agreement.monthlyRent)} on or before day ${configuration.rent.dueDay} of each month by ${list(configuration.rent.paymentModes) || 'a payment method agreed by both parties'}.`)

  if (configuration.rent.latePaymentEnabled) {
    add('late-payment', 'Late Payment', `A payment has a ${configuration.rent.graceDays}-day grace period. ${configuration.rent.latePaymentConsequence.trim()}`)
  }
  if (configuration.rent.escalationEnabled) {
    add('rent-escalation', 'Rent Escalation', `The monthly rent will increase by ${configuration.rent.escalationPercent}% after ${configuration.rent.escalationAfterMonths} months.`)
  }

  add(
    'security-deposit-refund',
    'Security Deposit',
    `The Tenant will provide a refundable security deposit of ${inr(agreement.securityDeposit)}. It will be refunded within ${configuration.deposit.refundDays} days after handover${configuration.deposit.deductions.length ? `, subject only to agreed deductions for ${list(configuration.deposit.deductions.map((item) => item.toLowerCase()))}` : ''}. Normal wear and tear will not be treated as damage.`,
  )

  if (configuration.maintenance.enabled) {
    add('maintenance', 'Maintenance and Society Charges', `Regular society and maintenance charges are ${possessiveRole(configuration.maintenance.regularChargesPaidBy)}. Major society assessments will be paid by the ${configuration.maintenance.majorAssessmentsPaidBy}.`)
  }
  if (configuration.utilities.enabled) {
    const enabled = configuration.utilities.items.filter((item) => item.enabled)
    if (enabled.length) add('utilities', 'Utilities', enabled.map((item) => `${item.name}: ${item.paidBy}`).join(' · ') + '.')
  }
  if (configuration.repairs.enabled) {
    add('repairs', 'Repairs and Maintenance', `The Tenant is responsible for ${list(configuration.repairs.tenantResponsibilities)}. The Landlord is responsible for ${list(configuration.repairs.landlordResponsibilities)}. These are the parties’ agreed responsibilities for this tenancy.`)
  }
  if (configuration.usage.enabled) {
    add('permitted-use', 'Permitted Use', `The premises will be used as a home${configuration.usage.workFromHome ? ', including reasonable work from home' : ''}.`)
    if (configuration.usage.sublettingEnabled) add('subletting', 'Subletting', configuration.usage.subletting === 'allowed' ? 'Subletting is allowed.' : 'Subletting requires the Landlord’s prior written consent.')
    if (configuration.usage.alterationsEnabled) add('alterations', 'Alterations', 'Material alterations to the premises require the Landlord’s prior approval.')
  }
  if (configuration.access.enabled) {
    add('property-access', 'Access and Inspection', `The Landlord will give reasonable prior notice of ${configuration.access.noticeHours} hours before access or inspection${configuration.access.emergencyException ? ', except in an emergency' : ''}.`)
  }
  if (configuration.term.lockInEnabled) add('lock-in', 'Lock-in Period', `A lock-in period of ${configuration.term.lockInMonths} months applies to ${configuration.term.lockInAppliesTo}.`)
  if (configuration.term.noticeEnabled) add('notice-termination', 'Notice and Termination', `Either party may end the tenancy by giving ${configuration.term.noticePeriod} notice.`)
  if (configuration.term.earlyTerminationEnabled && configuration.term.earlyTerminationReasons.length) add('early-termination', 'Early Termination', `The agreement may be ended early for ${list(configuration.term.earlyTerminationReasons.map((reason) => reason.toLowerCase()))}, after reasonable notice and an opportunity to resolve the issue where appropriate.`)
  if (configuration.term.renewalEnabled) add('renewal', 'Renewal', configuration.term.renewalType === 'automatic renewal' ? 'The tenancy will automatically renew on the same terms unless either party gives notice.' : 'The tenancy may be renewed by mutual written agreement.')

  if (configuration.occupancy.enabled) {
    if (configuration.occupancy.occupants.length) add('occupants', 'Additional Occupants', `${list(configuration.occupancy.occupants.map((occupant) => `${occupant.name}${occupant.relationship ? ` (${occupant.relationship})` : ''}`))} may also occupy the premises.`)
    if (configuration.occupancy.guestConditionsEnabled && configuration.occupancy.guestConditions.trim()) add('guests', 'Guests', configuration.occupancy.guestConditions.trim())
    if (configuration.occupancy.petsEnabled) add('pets', 'Pets', configuration.occupancy.pets === 'allowed with conditions' ? `Pets are allowed subject to these conditions: ${configuration.occupancy.petConditions.trim() || 'conditions agreed by both parties'}.` : `Pets are ${configuration.occupancy.pets}.`)
  }
  if (configuration.parking.enabled) add('parking', 'Parking', `The tenancy includes ${configuration.parking.type === 'both' ? 'car and two-wheeler' : configuration.parking.type} parking${configuration.parking.identifier.trim() ? ` identified as ${configuration.parking.identifier.trim()}` : ''}.`)
  if (configuration.restoration.enabled) {
    const restoration = configuration.restoration.type === 'same condition'
      ? 'The Tenant will return the premises in substantially the same condition, excluding normal wear and tear.'
      : configuration.restoration.type === 'agreed painting cost'
        ? 'Any painting cost deducted at exit must be agreed by both parties.'
        : configuration.restoration.customText.trim()
    if (restoration) add('restoration', 'Restoration at Exit', restoration)
  }

  const inventoryItems = configuration.furnishing.level === 'unfurnished' ? [] : configuration.furnishing.inventory
  if (inventoryItems.length) add('furnishings', 'Furnishings and Inventory', 'The premises are provided with the furnishings, fixtures and appliances recorded in Schedule A.')
  if (configuration.meterReadings.enabled) {
    const readings = Object.entries(configuration.meterReadings)
      .filter(([name, value]) => name !== 'enabled' && String(value).trim())
      .map(([name, value]) => `${name}: ${value}`)
    if (readings.length) add('meter-readings', 'Move-in Meter Readings', `${readings.join(' · ')}.`)
  }
  configuration.customTerms.filter((term) => term.text.trim()).forEach((term, index) => add(`custom-${term.id}`, `Custom Term ${index + 1}`, term.text.trim()))
  add('jurisdiction', 'Dispute Resolution and Jurisdiction', `The parties will first try to resolve disagreements in good faith. Courts with jurisdiction over ${agreement.property.city}, ${agreement.property.state} will have jurisdiction.`)
  add('execution', 'Execution', 'The Landlord and Tenant will sign the final agreement to confirm the terms they have agreed.')

  const optionalClauseCount = [
    configuration.rent.escalationEnabled,
    configuration.term.lockInEnabled,
    configuration.term.renewalEnabled,
    configuration.occupancy.enabled,
    configuration.parking.enabled,
    configuration.restoration.enabled,
    configuration.meterReadings.enabled,
    ...configuration.customTerms.map((term) => Boolean(term.text.trim())),
  ].filter(Boolean).length

  return { title: 'Residential Rent Agreement', clauses, inventory: inventoryItems, optionalClauseCount }
}

export function furnishingLabel(level: FurnishingLevel): string {
  return level === 'semi-furnished' ? 'Semi-furnished' : level === 'fully-furnished' ? 'Fully furnished' : 'Unfurnished'
}
