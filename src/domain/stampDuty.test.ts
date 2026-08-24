import { describe, expect, it } from 'vitest'
import { createInitialAgreementState } from './demoData'
import {
  configureStampDutyPayment,
  createStampDutyPayment,
  isStampDutyComplete,
  isValidLandlordPercentage,
  recordStampDutyPayment,
} from './stampDuty'

describe('stamp-duty payments', () => {
  it('allocates the default and preset splits', () => {
    expect(createStampDutyPayment(1800)).toMatchObject({
      landlord: { percentage: 50, amount: 900, status: 'pending' },
      tenant: { percentage: 50, amount: 900, status: 'pending' },
    })
    expect(createStampDutyPayment(1800, 100)).toMatchObject({
      landlord: { amount: 1800, status: 'pending' },
      tenant: { amount: 0, status: 'not-required' },
    })
    expect(createStampDutyPayment(1800, 0)).toMatchObject({
      landlord: { amount: 0, status: 'not-required' },
      tenant: { amount: 1800, status: 'pending' },
    })
  })

  it('supports custom whole percentages and gives the landlord the rounded-up rupee', () => {
    const payment = createStampDutyPayment(1801, 50)
    expect(payment.landlord.amount).toBe(901)
    expect(payment.tenant.amount).toBe(900)
    expect(createStampDutyPayment(1801, 33).landlord.amount).toBe(595)
    expect(isValidLandlordPercentage(33)).toBe(true)
    expect(isValidLandlordPercentage(33.5)).toBe(false)
    expect(isValidLandlordPercentage(-1)).toBe(false)
    expect(() => createStampDutyPayment(1800, 101)).toThrow(/invalid/i)
  })

  it('locks after payment, prevents duplicates, and completes only after required shares', () => {
    const agreement = createInitialAgreementState()
    agreement.stampDutyPayment = configureStampDutyPayment(agreement, 50, 'tenant')
    const first = recordStampDutyPayment(agreement, 'tenant', '2026-08-25T10:00:00.000Z', 'BI-STAMP-FIRST')
    expect(first.locked).toBe(true)
    expect(isStampDutyComplete(first)).toBe(false)
    agreement.stampDutyPayment = first
    expect(() => configureStampDutyPayment(agreement, 100, 'landlord')).toThrow(/locked/i)
    expect(() => recordStampDutyPayment(agreement, 'tenant')).toThrow(/already/i)

    const complete = recordStampDutyPayment(agreement, 'landlord', '2026-08-25T10:01:00.000Z', 'BI-STAMP-SECOND')
    expect(isStampDutyComplete(complete)).toBe(true)
    expect(complete.landlord.paymentReference).toBe('BI-STAMP-SECOND')
  })

  it('completes a 100/0 split after its only required payment', () => {
    const agreement = createInitialAgreementState()
    agreement.stampDutyPayment = configureStampDutyPayment(agreement, 0, 'tenant')
    expect(() => recordStampDutyPayment(agreement, 'landlord')).toThrow(/no contribution/i)
    const complete = recordStampDutyPayment(agreement, 'tenant')
    expect(isStampDutyComplete(complete)).toBe(true)
  })
})
