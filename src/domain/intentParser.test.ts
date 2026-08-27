import { describe, expect, it } from 'vitest'
import {
  associateMoneyWithContext,
  detectWorkflow,
  extractDuration,
  extractFurnishing,
  extractLocation,
  inferInitiator,
  normalizeText,
  parseIndianMoney,
  parseIntent,
  prefillDraftFromParsedIntent,
} from './intentParser'
import { emptyIntakeDraft } from './intake'

describe('normalizeText', () => {
  it('normalizes case, whitespace, apostrophes, and dashes', () => {
    expect(normalizeText('  I’M after a SEMI–FURNISHED flat  ')).toBe("i'm after a semi-furnished flat")
  })
})

describe('detectWorkflow', () => {
  it.each(['rent agreement', 'rental agreement', 'tenancy agreement', 'lease agreement'])(
    'recognizes the strong phrase %s',
    (phrase) => expect(detectWorkflow(`I need a ${phrase}`).value).toBe('rent_agreement'),
  )

  it.each(['Rental contract for my flat', 'I am a tenant', 'I want to rent out my property'])(
    'combines supporting evidence in %s',
    (input) => expect(detectWorkflow(input).value).toBe('rent_agreement'),
  )

  it('does not guess an unsupported workflow', () => {
    expect(detectWorkflow('I need an affidavit').value).toBe('unknown')
    expect(detectWorkflow('Show my current documents').value).toBe('unknown')
  })
})

describe('parseIndianMoney', () => {
  it.each([
    ['40000', 40_000],
    ['40,000', 40_000],
    ['₹40,000', 40_000],
    ['40k', 40_000],
    ['40 k', 40_000],
    ['1 lakh', 100_000],
    ['1.2 lakh', 120_000],
    ['1.2L', 120_000],
    ['2 lac', 200_000],
    ['2 lacs', 200_000],
    ['2 lakhs', 200_000],
    ['1 crore', 10_000_000],
    ['1.5 cr', 15_000_000],
  ])('normalizes %s', (input, expected) => {
    expect(parseIndianMoney(input)).toBe(expected)
  })

  it.each(['', '-40000', '1.25', 'forty thousand', '1.2.3 lakh'])(
    'rejects malformed money %s',
    (input) => expect(parseIndianMoney(input)).toBeNull(),
  )
})

describe('extractDuration', () => {
  it.each([
    ['11 months', 11],
    ['11 month', 11],
    ['2 years', 24],
    ['1 year', 12],
    ['11 mahine', 11],
    ['6 mahina', 6],
  ])('extracts %s', (input, expected) => {
    expect(extractDuration(input)?.value).toBe(expected)
  })

  it('omits absent, conflicting, or unreasonable durations', () => {
    expect(extractDuration('Need a rent agreement')).toBeUndefined()
    expect(extractDuration('0 months')).toBeUndefined()
    expect(extractDuration('11 months or 1 year')).toBeUndefined()
  })
})

describe('extractLocation', () => {
  it.each([
    ['Bangalore', 'Bengaluru', 'Karnataka'],
    ['Hyderabad', 'Hyderabad', 'Telangana'],
    ['Bombay', 'Mumbai', 'Maharashtra'],
    ['New Delhi', 'Delhi', 'Delhi'],
    ['Pune', 'Pune', 'Maharashtra'],
    ['Madras', 'Chennai', 'Tamil Nadu'],
    ['Calcutta', 'Kolkata', 'West Bengal'],
  ])('maps %s to its canonical city and state', (input, city, state) => {
    expect(extractLocation(`A flat in ${input}`)).toMatchObject({
      city: { value: city },
      state: { value: state },
    })
  })

  it('does not attempt generic location extraction', () => {
    expect(extractLocation('A flat in Mysuru')).toEqual({})
  })
})

describe('extractFurnishing', () => {
  it.each([
    ['unfurnished flat', 'unfurnished'],
    ['semi furnished apartment', 'semi_furnished'],
    ['semi-furnished apartment', 'semi_furnished'],
    ['fully furnished home', 'fully_furnished'],
    ['full furnished home', 'fully_furnished'],
  ] as const)('normalizes %s', (input, expected) => {
    expect(extractFurnishing(input)?.value).toBe(expected)
  })

  it('does not infer a furnishing level from generic furnished wording', () => {
    expect(extractFurnishing('a furnished home')).toBeUndefined()
  })
})

describe('inferInitiator', () => {
  it('recognizes explicit roles with high confidence', () => {
    expect(inferInitiator('I am the landlord')).toMatchObject({ value: 'landlord', confidence: 0.98 })
    expect(inferInitiator('I am a tenant')).toMatchObject({ value: 'tenant', confidence: 0.98 })
  })

  it('uses lower confidence for contextual inference', () => {
    expect(inferInitiator("I'm renting my flat")?.value).toBe('landlord')
    expect(inferInitiator('I am renting a flat')?.value).toBe('tenant')
    expect(inferInitiator("I'm renting my flat")!.confidence).toBeLessThan(0.8)
  })

  it('leaves an unclear role unset', () => {
    expect(inferInitiator('Need a rent agreement for our flat')).toBeUndefined()
  })
})

describe('money association', () => {
  it('supports labels before and after their values', () => {
    expect(associateMoneyWithContext('rent 40k and 1.2 lakh deposit')).toMatchObject({
      monthlyRent: { value: 40_000 },
      securityDeposit: { value: 120_000 },
    })
    expect(associateMoneyWithContext('45,000 rent with security deposit 2 lakh')).toMatchObject({
      monthlyRent: { value: 45_000 },
      securityDeposit: { value: 200_000 },
    })
    expect(associateMoneyWithContext('rent is ₹40,000 pm')).toMatchObject({ monthlyRent: { value: 40_000 } })
  })

  it('does not assign ambiguous or unlabelled amounts', () => {
    expect(associateMoneyWithContext('rent and deposit are 40k')).toEqual({})
    expect(associateMoneyWithContext('the amounts are 40k and 1 lakh')).toEqual({
      monthlyRent: undefined,
      securityDeposit: undefined,
    })
  })

  it('does not treat a negative amount as valid', () => {
    expect(associateMoneyWithContext('rent -40k')).toEqual({ monthlyRent: undefined, securityDeposit: undefined })
  })
})

describe('parseIntent', () => {
  it('parses the complete Bengaluru demo request', () => {
    const parsed = parseIntent('I need an 11 month rent agreement for a semi-furnished flat in Bengaluru for 40k a month with a 1.2 lakh deposit.')
    expect(parsed).toMatchObject({
      workflow: { value: 'rent_agreement' },
      city: { value: 'Bengaluru' },
      state: { value: 'Karnataka' },
      durationMonths: { value: 11 },
      monthlyRent: { value: 40_000 },
      securityDeposit: { value: 120_000 },
      furnishingLevel: { value: 'semi_furnished' },
    })
  })

  it('parses landlord context without inventing commercial terms', () => {
    const parsed = parseIntent("I'm renting my flat in Bangalore for 11 months.")
    expect(parsed).toMatchObject({
      workflow: { value: 'rent_agreement' }, city: { value: 'Bengaluru' },
      durationMonths: { value: 11 }, initiator: { value: 'landlord' },
    })
    expect(parsed.monthlyRent).toBeUndefined()
    expect(parsed.securityDeposit).toBeUndefined()
  })

  it('parses an explicit Hyderabad tenant request', () => {
    expect(parseIntent('I am a tenant paying 45,000 rent and 2 lakh deposit in Hyderabad.')).toMatchObject({
      workflow: { value: 'rent_agreement' }, city: { value: 'Hyderabad' }, state: { value: 'Telangana' },
      monthlyRent: { value: 45_000 }, securityDeposit: { value: 200_000 }, initiator: { value: 'tenant' },
    })
  })

  it('parses furnishing and location from a short Mumbai request', () => {
    expect(parseIntent('Need a fully furnished rental agreement in Mumbai.')).toMatchObject({
      workflow: { value: 'rent_agreement' }, city: { value: 'Mumbai' }, state: { value: 'Maharashtra' },
      furnishingLevel: { value: 'fully_furnished' },
    })
  })

  it('handles the required Hinglish example', () => {
    expect(parseIntent('Bangalore mein 11 mahine ka rent agreement banana hai, rent 40k hai aur deposit 1.2 lakh.')).toMatchObject({
      workflow: { value: 'rent_agreement' }, city: { value: 'Bengaluru' }, durationMonths: { value: 11 },
      monthlyRent: { value: 40_000 }, securityDeposit: { value: 120_000 },
    })
  })

  it('returns only unknown for unsupported intent', () => {
    expect(parseIntent('I need an affidavit.')).toEqual({
      workflow: expect.objectContaining({ value: 'unknown' }),
    })
  })

  it('transfers only parsed fields into the existing intake draft', () => {
    const draft = prefillDraftFromParsedIntent(emptyIntakeDraft, parseIntent('11 month rent agreement in Bangalore, rent 40k'))
    expect(draft).toMatchObject({ city: 'Bengaluru', state: 'Karnataka', durationMonths: '11', monthlyRent: '40000' })
    expect(draft.address).toBe('')
    expect(draft.securityDeposit).toBe('')
  })
})
