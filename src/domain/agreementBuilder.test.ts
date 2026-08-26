import { describe, expect, it } from 'vitest'
import { createDefaultAgreementBuilderConfiguration, generateAgreement } from './agreementBuilder'
import { createInitialAgreementState } from './demoData'

function demoAgreement() {
  return {
    ...createInitialAgreementState(),
    property: {
      address: '24A, Lotus Heights, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      propertyType: 'residential-apartment' as const,
    },
    monthlyRent: 40_000,
    securityDeposit: 120_000,
    durationMonths: 11,
    startDate: '2026-09-01',
    landlord: { id: 'landlord' as const, name: 'Arjun Rao', identityVerified: false, approvedAgreement: false, signed: false },
    tenant: { id: 'tenant' as const, name: 'Meera Sharma', identityVerified: false, approvedAgreement: false, signed: false },
  }
}

describe('agreement builder generation', () => {
  it('generates essential and recommended clauses plus Schedule A data from demo defaults', () => {
    const generated = generateAgreement(demoAgreement())
    expect(generated.clauses.map((clause) => clause.id)).toEqual(expect.arrayContaining([
      'parties', 'premises', 'term', 'monthly-rent', 'security-deposit-refund',
      'maintenance', 'utilities', 'repairs', 'permitted-use', 'subletting',
      'property-access', 'notice-termination', 'execution',
    ]))
    expect(generated.clauses.find((clause) => clause.id === 'security-deposit-refund')?.text).toContain('30 days')
    expect(generated.inventory).toHaveLength(7)
    expect(generated.inventory.some((item) => item.name === 'Gas stove')).toBe(true)
  })

  it('changes generated text, omits disabled clauses, and keeps section input ordered', () => {
    const configuration = createDefaultAgreementBuilderConfiguration()
    configuration.deposit.refundDays = 7
    configuration.usage.sublettingEnabled = false
    configuration.parking = { enabled: true, type: 'car', identifier: 'B-42' }
    configuration.occupancy.enabled = true
    configuration.occupancy.petsEnabled = true
    configuration.occupancy.pets = 'allowed with conditions'
    configuration.occupancy.petConditions = 'No disturbance to neighbours'

    const generated = generateAgreement(demoAgreement(), configuration)
    expect(generated.clauses.find((clause) => clause.id === 'security-deposit-refund')?.text).toContain('7 days')
    expect(generated.clauses.some((clause) => clause.id === 'subletting')).toBe(false)
    expect(generated.clauses.find((clause) => clause.id === 'premises')?.text).not.toContain('B-42')
    expect(generated.clauses.find((clause) => clause.id === 'parking')?.text).toContain('B-42')
    expect(generated.clauses.find((clause) => clause.id === 'pets')?.text).toContain('No disturbance')
  })

  it('removes the inventory schedule for an unfurnished home and supports custom clauses', () => {
    const configuration = createDefaultAgreementBuilderConfiguration()
    configuration.furnishing.level = 'unfurnished'
    configuration.customTerms = [{ id: 'wall-tv', text: 'A wall-mounted television needs landlord approval.' }]
    const generated = generateAgreement(demoAgreement(), configuration)

    expect(generated.inventory).toEqual([])
    expect(generated.clauses.some((clause) => clause.id === 'furnishings')).toBe(false)
    expect(generated.clauses.find((clause) => clause.id === 'custom-wall-tv')?.text).toContain('television')
  })
})
