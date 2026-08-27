import type { FurnishingLevel, IntakeDraft, PartyRole } from './types'

export interface ParsedField<T> {
  value: T
  confidence: number
  source: string
}

export interface ParsedIntent {
  workflow: ParsedField<'rent_agreement' | 'unknown'>
  city?: ParsedField<string>
  state?: ParsedField<string>
  durationMonths?: ParsedField<number>
  monthlyRent?: ParsedField<number>
  securityDeposit?: ParsedField<number>
  furnishingLevel?: ParsedField<'unfurnished' | 'semi_furnished' | 'fully_furnished'>
  initiator?: ParsedField<PartyRole>
}

export interface MoneyMention {
  value: number
  source: string
  start: number
  end: number
}

export const cityAliases = [
  { city: 'Bengaluru', state: 'Karnataka', aliases: ['bengaluru', 'bangalore'] },
  { city: 'Hyderabad', state: 'Telangana', aliases: ['hyderabad'] },
  { city: 'Mumbai', state: 'Maharashtra', aliases: ['mumbai', 'bombay'] },
  { city: 'Delhi', state: 'Delhi', aliases: ['new delhi', 'delhi'] },
  { city: 'Pune', state: 'Maharashtra', aliases: ['pune'] },
  { city: 'Chennai', state: 'Tamil Nadu', aliases: ['chennai', 'madras'] },
  { city: 'Kolkata', state: 'West Bengal', aliases: ['kolkata', 'calcutta'] },
  { city: 'Ahmedabad', state: 'Gujarat', aliases: ['ahmedabad', 'amdavad'] },
  { city: 'Surat', state: 'Gujarat', aliases: ['surat'] },
  { city: 'Jaipur', state: 'Rajasthan', aliases: ['jaipur'] },
  { city: 'Lucknow', state: 'Uttar Pradesh', aliases: ['lucknow'] },
  { city: 'Kanpur', state: 'Uttar Pradesh', aliases: ['kanpur'] },
  { city: 'Nagpur', state: 'Maharashtra', aliases: ['nagpur'] },
  { city: 'Indore', state: 'Madhya Pradesh', aliases: ['indore'] },
  { city: 'Thane', state: 'Maharashtra', aliases: ['thane'] },
  { city: 'Bhopal', state: 'Madhya Pradesh', aliases: ['bhopal'] },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh', aliases: ['visakhapatnam', 'vishakhapatnam', 'vizag'] },
  { city: 'Pimpri-Chinchwad', state: 'Maharashtra', aliases: ['pimpri-chinchwad', 'pimpri chinchwad'] },
  { city: 'Patna', state: 'Bihar', aliases: ['patna'] },
  { city: 'Vadodara', state: 'Gujarat', aliases: ['vadodara', 'baroda'] },
  { city: 'Ghaziabad', state: 'Uttar Pradesh', aliases: ['ghaziabad'] },
  { city: 'Ludhiana', state: 'Punjab', aliases: ['ludhiana'] },
  { city: 'Agra', state: 'Uttar Pradesh', aliases: ['agra'] },
  { city: 'Nashik', state: 'Maharashtra', aliases: ['nashik', 'nasik'] },
  { city: 'Faridabad', state: 'Haryana', aliases: ['faridabad'] },
  { city: 'Meerut', state: 'Uttar Pradesh', aliases: ['meerut'] },
  { city: 'Rajkot', state: 'Gujarat', aliases: ['rajkot'] },
  { city: 'Kalyan-Dombivli', state: 'Maharashtra', aliases: ['kalyan-dombivli', 'kalyan dombivli', 'kalyan dombivali'] },
  { city: 'Vasai-Virar', state: 'Maharashtra', aliases: ['vasai-virar', 'vasai virar'] },
  { city: 'Varanasi', state: 'Uttar Pradesh', aliases: ['varanasi', 'banaras', 'benares'] },
] as const

const agreementMisspellings = /\b(?:agriment|agrement|aggrement|aggreement|agreeement)\b/g
const MAX_TENANCY_MONTHS = 60
const MIN_CONTEXTUAL_MONEY_AMOUNT = 1_000

export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .toLocaleLowerCase('en-IN')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeIntentVocabulary(input: string): string {
  return normalizeText(input).replace(agreementMisspellings, 'agreement')
}

function field<T>(value: T, confidence: number, source: string): ParsedField<T> {
  return { value, confidence, source }
}

function phrasePattern(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i')
}

function matchedPhrase(text: string, phrases: readonly string[]): string | undefined {
  return [...phrases]
    .sort((a, b) => b.length - a.length)
    .find((phrase) => phrasePattern(phrase).test(text))
}

export function detectWorkflow(text: string): ParsedField<'rent_agreement' | 'unknown'> {
  const rawNormalized = normalizeText(text)
  const normalized = normalizeIntentVocabulary(rawNormalized)
  const spellingCorrected = normalized !== rawNormalized
  const strong = matchedPhrase(normalized, [
    'rent agreement', 'rental agreement', 'tenancy agreement', 'lease agreement',
  ])
  if (strong) return field('rent_agreement', spellingCorrected ? 0.92 : 0.98, spellingCorrected ? rawNormalized : strong)

  const weightedPhrases: ReadonlyArray<[string, number]> = [
    ['rent out', 3], ['lease out', 3], ['rent pe', 2], ['kiraya', 2],
    ['renting', 2], ['rental', 2], ['lease', 2], ['rent', 2],
    ['i am a tenant', 3], ['i am the tenant', 3], ['i am a landlord', 3], ['i am the landlord', 3],
    ['tenant', 1], ['landlord', 1], ['flat', 1], ['apartment', 1],
    ['house', 1], ['home', 1], ['property', 1], ['ghar', 1], ['makaan', 1], ['contract', 1],
  ]
  const matches = weightedPhrases.filter(([phrase]) => phrasePattern(phrase).test(normalized))
  const score = matches.reduce((total, [, weight]) => total + weight, 0)
  if (score >= 3) {
    const confidence = score >= 5 ? 0.9 : score >= 4 ? 0.84 : 0.76
    return field('rent_agreement', confidence, matches.map(([phrase]) => phrase).join(', '))
  }
  return field('unknown', score === 0 ? 1 : 0.75, matches.map(([phrase]) => phrase).join(', ') || normalized)
}

export function extractLocation(text: string): Pick<ParsedIntent, 'city' | 'state'> {
  const normalized = normalizeText(text)
  const candidates = cityAliases.flatMap((location) => location.aliases.map((alias) => ({ ...location, alias })))
    .sort((a, b) => b.alias.length - a.alias.length)
  const match = candidates.find(({ alias }) => phrasePattern(alias).test(normalized))
  return match
    ? { city: field(match.city, 0.97, match.alias), state: field(match.state, 0.97, match.alias) }
    : {}
}

export function extractDuration(text: string): ParsedField<number> | undefined {
  const normalized = normalizeText(text)
  // Do not read a trailing group from currency, decimal, comma-formatted, negative, or longer numbers.
  const pattern = /(?<![-\d,₹.])\b(\d{1,3})\s*(years?|yrs?|months?|mos?|mahine|mahina)\b/g
  const matches = [...normalized.matchAll(pattern)]
    .map((match) => {
      const count = Number(match[1])
      const years = /^(?:year|yr)/.test(match[2])
      return { source: match[0], months: years ? count * 12 : count }
    })
    .filter(({ months }) => Number.isInteger(months) && months >= 1 && months <= MAX_TENANCY_MONTHS)
  if (matches.length !== 1) return undefined
  return field(matches[0].months, 0.96, matches[0].source)
}

export function parseIndianMoney(input: string): number | null {
  const normalized = normalizeText(input).replace(/₹/g, '').trim()
  const match = normalized.match(/^(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(k|l|lac|lacs|lakh|lakhs|cr|crore|crores)?$/)
  if (!match) return null
  const numeric = Number(match[1].replace(/,/g, ''))
  const multiplier = match[2] === 'k'
    ? 1_000
    : ['l', 'lac', 'lacs', 'lakh', 'lakhs'].includes(match[2] ?? '')
      ? 100_000
      : ['cr', 'crore', 'crores'].includes(match[2] ?? '')
        ? 10_000_000
        : 1
  const amount = numeric * multiplier
  return Number.isFinite(amount) && amount > 0 && Number.isInteger(amount) ? amount : null
}

export function extractMoneyMentions(text: string): MoneyMention[] {
  const normalized = normalizeText(text)
  const pattern = /(?<![-\d.])(?:₹\s*)?(?:\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(?:crores?|crore|cr|lakhs?|lakh|lacs?|lac|l|k)?\b(?![\d,]|\.\d)/gi
  return [...normalized.matchAll(pattern)].flatMap((match) => {
    const source = match[0].trim()
    const value = parseIndianMoney(source)
    if (value === null || (value < MIN_CONTEXTUAL_MONEY_AMOUNT && !source.includes('₹'))) return []
    const start = match.index ?? 0
    return [{ value, source, start, end: start + match[0].length }]
  })
}

interface ContextMatch {
  kind: 'rent' | 'deposit'
  start: number
  end: number
  source: string
}

function moneyContexts(text: string): ContextMatch[] {
  const definitions = {
    rent: ['monthly rent', 'per month', '/month', 'a month', 'rent', 'kiraya', 'mahina', 'mahine', 'pm'],
    deposit: ['refundable deposit', 'security deposit', 'deposit', 'advance', 'security', 'jama'],
  } as const
  return (Object.entries(definitions) as Array<[ContextMatch['kind'], readonly string[]]>).flatMap(([kind, phrases]) =>
    phrases.flatMap((phrase) => [...text.matchAll(new RegExp(phrasePattern(phrase).source, 'gi'))].map((match) => {
      const source = match[0].trim()
      const start = (match.index ?? 0) + match[0].indexOf(source)
      return { kind, source, start, end: start + source.length }
    })),
  )
}

export function associateMoneyWithContext(
  text: string,
  mentions = extractMoneyMentions(text),
): Pick<ParsedIntent, 'monthlyRent' | 'securityDeposit'> {
  const normalized = normalizeText(text)
  const contexts = moneyContexts(normalized)
  if (mentions.length === 1) {
    const nearbyKinds = new Set(contexts.filter((context) => {
      const mention = mentions[0]
      const distance = context.end <= mention.start
        ? mention.start - context.end
        : context.start >= mention.end
          ? context.start - mention.end
          : 0
      return distance <= 32
    }).map((context) => context.kind))
    if (nearbyKinds.size > 1) return {}
  }
  const assignments: Array<{ mention: MoneyMention; kind: ContextMatch['kind']; confidence: number }> = []

  function contextDistance(context: ContextMatch, mention: MoneyMention): number {
    if (context.end <= mention.start) return mention.start - context.end
    if (context.start >= mention.end) return context.start - mention.end
    return 0
  }

  for (const mention of mentions) {
    const nearby = contexts.flatMap((context) => {
      const before = context.end <= mention.start
      const distance = contextDistance(context, mention)
      if (distance < 0 || distance > 24) return []
      if (mentions.some((other) => other !== mention && contextDistance(context, other) < distance)) return []
      const confidence = Math.max(0.68, (before ? 0.94 : 0.9) - distance * 0.01)
      return [{ context, confidence, distance }]
    }).filter(({ context }) => !assignments.some((assignment) => assignment.kind === context.kind))
      .sort((a, b) => b.confidence - a.confidence || a.distance - b.distance)

    if (!nearby.length) continue
    const best = nearby[0]
    const competing = nearby.find(({ context }) => context.kind !== best.context.kind)
    if (competing && best.confidence - competing.confidence < 0.06) continue
    assignments.push({ mention, kind: best.context.kind, confidence: best.confidence })
  }

  function assigned(kind: ContextMatch['kind']): ParsedField<number> | undefined {
    const matches = assignments.filter((assignment) => assignment.kind === kind)
    if (matches.length !== 1) return undefined
    return field(matches[0].mention.value, matches[0].confidence, matches[0].mention.source)
  }

  return { monthlyRent: assigned('rent'), securityDeposit: assigned('deposit') }
}

export function extractFurnishing(text: string): ParsedIntent['furnishingLevel'] {
  const normalized = normalizeText(text)
  const patterns: ReadonlyArray<[RegExp, ParsedIntent['furnishingLevel'] extends ParsedField<infer T> | undefined ? T : never]> = [
    [/\bunfurnished\b/, 'unfurnished'],
    [/\bsemi[ -]?furnished\b/, 'semi_furnished'],
    [/\b(?:fully|full)[ -]?furnished\b/, 'fully_furnished'],
  ]
  const match = patterns.find(([pattern]) => pattern.test(normalized))
  if (!match) return undefined
  const source = normalized.match(match[0])?.[0] ?? ''
  return field(match[1], 0.97, source)
}

export function inferInitiator(text: string): ParsedIntent['initiator'] {
  const normalized = normalizeText(text)
  const explicitLandlord = matchedPhrase(normalized, ['i am the landlord', 'i am a landlord'])
  const explicitTenant = matchedPhrase(normalized, ['i am the tenant', 'i am a tenant'])
  if (explicitLandlord && explicitTenant) return undefined
  if (explicitLandlord) return field('landlord', 0.98, explicitLandlord)
  if (explicitTenant) return field('tenant', 0.98, explicitTenant)

  const landlord = matchedPhrase(normalized, [
    'rent out my flat', 'renting out my flat', 'renting my flat', 'renting out my property',
    'lease out my house', 'my tenant',
  ])
  const tenant = matchedPhrase(normalized, [
    'my landlord', 'i am renting a flat', 'moving into a rented flat', 'taking a flat on rent',
  ])
  if (landlord && tenant) return undefined
  if (landlord) return field('landlord', 0.72, landlord)
  if (tenant) return field('tenant', 0.68, tenant)
  return undefined
}

export function validateParsedIntent(parsed: ParsedIntent): ParsedIntent {
  const validDuration = parsed.durationMonths && parsed.durationMonths.value >= 1 && parsed.durationMonths.value <= 60
  const validRent = parsed.monthlyRent && parsed.monthlyRent.value > 0 && parsed.monthlyRent.value <= 1_000_000_000
  const validDeposit = parsed.securityDeposit && parsed.securityDeposit.value > 0 && parsed.securityDeposit.value <= 1_000_000_000
  return {
    ...parsed,
    durationMonths: validDuration ? parsed.durationMonths : undefined,
    monthlyRent: validRent ? parsed.monthlyRent : undefined,
    securityDeposit: validDeposit ? parsed.securityDeposit : undefined,
  }
}

export function parseIntent(input: string): ParsedIntent {
  const normalized = normalizeText(input)
  const workflow = detectWorkflow(normalized)
  if (workflow.value === 'unknown') return { workflow }
  const moneyMentions = extractMoneyMentions(normalized)
  return validateParsedIntent({
    workflow,
    ...extractLocation(normalized),
    durationMonths: extractDuration(normalized),
    ...associateMoneyWithContext(normalized, moneyMentions),
    furnishingLevel: extractFurnishing(normalized),
    initiator: inferInitiator(normalized),
  })
}

export function prefillDraftFromParsedIntent(draft: IntakeDraft, parsed: ParsedIntent): IntakeDraft {
  if (parsed.workflow.value !== 'rent_agreement') return draft
  return {
    ...draft,
    initiator: parsed.initiator?.value ?? draft.initiator,
    city: parsed.city?.value ?? draft.city,
    state: parsed.state?.value ?? draft.state,
    durationMonths: parsed.durationMonths ? String(parsed.durationMonths.value) : draft.durationMonths,
    monthlyRent: parsed.monthlyRent ? String(parsed.monthlyRent.value) : draft.monthlyRent,
    securityDeposit: parsed.securityDeposit ? String(parsed.securityDeposit.value) : draft.securityDeposit,
  }
}

export function appFurnishingLevel(parsed: ParsedIntent): FurnishingLevel | undefined {
  const level = parsed.furnishingLevel?.value
  return level === 'semi_furnished' ? 'semi-furnished' : level === 'fully_furnished' ? 'fully-furnished' : level
}
