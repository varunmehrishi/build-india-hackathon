import { describe, expect, it } from 'vitest'
import { createInitialAgreementState } from './demoData'
import {
  applyIntakeDraft,
  classifyIntent,
  demoIntakeDraft,
  emptyIntakeDraft,
  validateIntake,
} from './intake'

describe('classifyIntent', () => {
  it.each(['rent agreement', 'Rental contract', 'home lease', 'I am a tenant'])(
    'routes %s to the rent workflow',
    (input) => expect(classifyIntent(input)).toBe('rent-agreement'),
  )

  it('rejects an unsupported request', () => {
    expect(classifyIntent('I need an affidavit')).toBe('unsupported')
    expect(classifyIntent('Show my current documents')).toBe('unsupported')
  })
})

describe('validateIntake', () => {
  it('accepts the canonical demo details', () => {
    expect(validateIntake(demoIntakeDraft)).toEqual({})
  })

  it('reports every blank field', () => {
    expect(Object.keys(validateIntake(emptyIntakeDraft))).toHaveLength(11)
  })

  it('enforces numeric boundaries', () => {
    const errors = validateIntake({
      ...demoIntakeDraft,
      monthlyRent: '0',
      securityDeposit: '-1',
      durationMonths: '61',
    })
    expect(errors.monthlyRent).toBeDefined()
    expect(errors.securityDeposit).toBeDefined()
    expect(errors.durationMonths).toBeDefined()
  })

  it('rejects calendar dates that do not exist', () => {
    expect(validateIntake({ ...demoIntakeDraft, startDate: '2026-02-30' }).startDate).toBeDefined()
  })
})

describe('applyIntakeDraft', () => {
  it('normalizes and commits the validated details', () => {
    const result = applyIntakeDraft(createInitialAgreementState(), {
      ...demoIntakeDraft,
      city: '  Mysuru  ',
      landlordName: '  Arjun Rao ',
    })

    expect(result.property.city).toBe('Mysuru')
    expect(result.landlord.name).toBe('Arjun Rao')
    expect(result.monthlyRent).toBe(40000)
    expect(result.intakeCompleted).toBe(true)
    expect(result.workflowStep).toBe('requirements')
  })
})
