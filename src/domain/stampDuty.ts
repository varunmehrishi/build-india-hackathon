import type {
  AgreementState,
  PartyRole,
  StampDutyContribution,
  StampDutyPaymentState,
} from './types'

function contribution(percentage: number, amount: number): StampDutyContribution {
  return {
    percentage,
    amount,
    status: amount === 0 ? 'not-required' : 'pending',
  }
}

export function isValidLandlordPercentage(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100
}

export function createStampDutyPayment(
  totalAmount: number,
  landlordPercentage = 50,
  configuredBy?: PartyRole,
): StampDutyPaymentState {
  if (!Number.isInteger(totalAmount) || totalAmount < 0 || !isValidLandlordPercentage(landlordPercentage)) {
    throw new Error('Invalid stamp-duty allocation.')
  }
  const landlordAmount = Math.ceil(totalAmount * landlordPercentage / 100)
  const tenantAmount = totalAmount - landlordAmount
  return {
    landlord: contribution(landlordPercentage, landlordAmount),
    tenant: contribution(100 - landlordPercentage, tenantAmount),
    configuredBy,
    locked: false,
  }
}

export function stampDutyPaymentFor(agreement: AgreementState): StampDutyPaymentState {
  return agreement.stampDutyPayment
    ?? createStampDutyPayment(agreement.requirements.stampDutyAmount)
}

export function configureStampDutyPayment(
  agreement: AgreementState,
  landlordPercentage: number,
  configuredBy: PartyRole,
): StampDutyPaymentState {
  const current = stampDutyPaymentFor(agreement)
  if (current.locked || current.landlord.status === 'paid' || current.tenant.status === 'paid') {
    throw new Error('The payment split is locked after the first payment.')
  }
  return createStampDutyPayment(
    agreement.requirements.stampDutyAmount,
    landlordPercentage,
    configuredBy,
  )
}

export function isStampDutyComplete(payment: StampDutyPaymentState): boolean {
  return (['landlord', 'tenant'] as const).every((role) => {
    const item = payment[role]
    return item.status === 'paid' || item.status === 'not-required'
  })
}

export function prepareStampDutyStep(agreement: AgreementState): AgreementState {
  if (agreement.requirements.stampDutyAmount !== 0) return agreement
  const stampDutyPayment = stampDutyPaymentFor(agreement)
  return { ...agreement, stampDutyPayment, stampCompleted: isStampDutyComplete(stampDutyPayment) }
}

function createPaymentReference(role: PartyRole, paidAt: string): string {
  const compactTime = paidAt.replace(/\D/g, '').slice(0, 14)
  const suffix = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 6).toUpperCase()
    ?? Math.random().toString(36).slice(2, 8).toUpperCase()
  return `SS-STAMP-${compactTime}-${role === 'landlord' ? 'LL' : 'TN'}-${suffix}`
}

export function recordStampDutyPayment(
  agreement: AgreementState,
  role: PartyRole,
  paidAt = new Date().toISOString(),
  paymentReference = createPaymentReference(role, paidAt),
): StampDutyPaymentState {
  const current = stampDutyPaymentFor(agreement)
  const item = current[role]
  if (item.status === 'paid') throw new Error('This contribution has already been paid.')
  if (item.status === 'not-required' || item.amount === 0) {
    throw new Error('This party has no contribution to pay.')
  }

  const paid: StampDutyPaymentState = {
    ...current,
    locked: true,
    [role]: {
      ...item,
      status: 'paid',
      paymentReference,
      paidAt,
    },
  }
  return paid
}
