import { resolveAgreementBuilderConfiguration } from './agreementBuilder'
import { clearExecutionVerification } from './identityVerification'
import type {
  AgreementReviewState,
  AgreementState,
  Clause,
  PartyRole,
  ProposedChange,
  ReviewEvent,
} from './types'

export interface ClauseExplanation {
  summary: string
  keyPoints?: string[]
}

export interface ProposalPreview {
  oldText: string
  newText: string
  summary: string
  structuredChange: NonNullable<ProposedChange['structuredChange']>
}

const suggestions: Record<string, string[]> = {
  'security-deposit-refund': [
    'What can be deducted from the deposit?',
    'When will the deposit be returned?',
    'What does normal wear and tear mean?',
  ],
  repairs: ['Who pays for major repairs?', 'What counts as tenant damage?'],
  'lock-in': ['What happens if I leave early?', 'Does the lock-in apply to both parties?'],
  subletting: ['Does this allow subletting?'],
  'property-access': ['Can the landlord enter whenever they want?'],
}

function eventId(type: string, index: number): string {
  return `${type}-${Date.now()}-${index}`
}

function addEvent(
  review: AgreementReviewState,
  type: ReviewEvent['type'],
  message: string,
  actor?: PartyRole,
  timestamp = new Date().toISOString(),
): AgreementReviewState {
  return {
    ...review,
    events: [...review.events, { id: eventId(type, review.events.length), type, actor, timestamp, message }],
  }
}

export function createReviewState(agreement: AgreementState): AgreementReviewState {
  return {
    currentRole: agreement.initiator,
    selectedClauseId: agreement.clauses[0]?.id,
    proposals: [],
    events: [],
  }
}

export function resolveReviewState(agreement: AgreementState): AgreementReviewState {
  return agreement.review ?? createReviewState(agreement)
}

export function suggestedQuestions(clauseId: string): string[] {
  return suggestions[clauseId] ?? ['What does this mean?']
}

export function explainClause(clause: Clause, question: string): ClauseExplanation {
  const normalized = question.toLowerCase()
  if (clause.id === 'security-deposit-refund') {
    const days = clause.text.match(/within (\d+) days/i)?.[1] ?? 'the agreed number of'
    if (normalized.includes('wear and tear')) {
      return { summary: 'Normal wear and tear means ordinary changes from everyday use, rather than avoidable damage.', keyPoints: ['The agreement says normal wear and tear is not treated as damage.', 'Agreed deductions can still cover unpaid amounts or damage beyond ordinary use.'] }
    }
    if (normalized.includes('deduct')) {
      return { summary: 'The deposit may be reduced only for the deduction categories written in this agreement.', keyPoints: ['The listed examples include unpaid rent, outstanding utilities, and damage beyond normal wear and tear.'] }
    }
    return { summary: `The landlord has up to ${days} days after handover to return the security deposit.`, keyPoints: ['Agreed deductions may still be made.', 'Normal wear and tear is not treated as damage.'] }
  }
  if (clause.id === 'repairs') return { summary: 'This clause divides routine upkeep and tenant-caused damage from structural or major defects.', keyPoints: ['The tenant handles the responsibilities specifically listed for the tenant.', 'The landlord handles the major items specifically listed for the landlord.'] }
  if (clause.id === 'subletting') return { summary: clause.text.includes('requires') ? 'The tenant needs the landlord’s written consent before subletting.' : 'This agreement allows subletting.' }
  if (clause.id === 'lock-in') return { summary: 'The lock-in records a period during which the named party or parties agree not to end the tenancy through the ordinary notice route.' }
  if (clause.id === 'property-access') return { summary: 'This clause sets the notice the landlord agrees to give before entering or inspecting the home, with any stated emergency exception.' }
  if (normalized.includes('what does this mean') || normalized.includes('explain')) {
    return { summary: `In plain language: ${clause.text}` }
  }
  return { summary: 'I can currently help explain the clauses in this agreement and propose changes to selected terms. Try one of the suggested questions for this clause.' }
}

export function previewProposal(clause: Clause, question: string): ProposalPreview | null {
  if (clause.id !== 'security-deposit-refund') return null
  const requestedDays = question.match(/(?:make|within|in|to)\D{0,12}(\d{1,3})\s*days?/i)?.[1]
  const currentDays = clause.text.match(/within (\d+) days/i)?.[1]
  if (!requestedDays || !currentDays || requestedDays === currentDays) return null
  const value = Number(requestedDays)
  if (!Number.isInteger(value) || value < 1 || value > 365) return null
  return {
    oldText: clause.text,
    newText: clause.text.replace(/within \d+ days/i, `within ${value} days`),
    summary: `Deposit refund ${currentDays} days → ${value} days`,
    structuredChange: { field: 'deposit.refundDays', value },
  }
}

export function createProposal(
  agreement: AgreementState,
  clauseId: string,
  question: string,
  timestamp = new Date().toISOString(),
): AgreementState {
  const review = resolveReviewState(agreement)
  const clause = agreement.clauses.find((item) => item.id === clauseId)
  const preview = clause ? previewProposal(clause, question) : null
  if (!clause || !preview || agreement.finalized) return agreement
  const proposal: ProposedChange = {
    id: `proposal-${Date.now()}-${review.proposals.length}`,
    clauseId,
    proposedBy: review.currentRole,
    ...preview,
    reason: question.trim(),
    status: 'pending',
    createdAt: timestamp,
  }
  const withProposal = { ...review, proposals: [...review.proposals, proposal] }
  const actorName = agreement[review.currentRole].name
  return {
    ...agreement,
    review: addEvent(withProposal, 'proposal-created', `${actorName} proposed: ${preview.summary}`, review.currentRole, timestamp),
  }
}

export function resolveProposal(
  agreement: AgreementState,
  proposalId: string,
  decision: 'accepted' | 'rejected',
  timestamp = new Date().toISOString(),
): AgreementState {
  const review = resolveReviewState(agreement)
  const proposal = review.proposals.find((item) => item.id === proposalId)
  if (!proposal || proposal.status !== 'pending' || proposal.proposedBy === review.currentRole || agreement.finalized) return agreement
  const proposals = review.proposals.map((item) => item.id === proposalId
    ? { ...item, status: decision, resolvedAt: timestamp, resolvedBy: review.currentRole } as ProposedChange
    : item)
  const actorName = agreement[review.currentRole].name
  let nextReview = addEvent({ ...review, proposals }, decision === 'accepted' ? 'proposal-accepted' : 'proposal-rejected', `${actorName} ${decision === 'accepted' ? 'accepted' : 'rejected'}: ${proposal.summary}`, review.currentRole, timestamp)
  if (decision === 'rejected') return { ...agreement, review: nextReview }

  const version = agreement.agreementVersion + 1
  const clauses = agreement.clauses.map((clause) => clause.id === proposal.clauseId
    ? { ...clause, previousText: clause.text, text: proposal.newText, status: 'accepted' as const }
    : clause)
  let agreementBuilder = agreement.agreementBuilder
  if (proposal.structuredChange?.field === 'deposit.refundDays') {
    const configuration = resolveAgreementBuilderConfiguration(agreement)
    agreementBuilder = { ...configuration, deposit: { ...configuration.deposit, refundDays: proposal.structuredChange.value } }
  }
  nextReview = addEvent(
    { ...nextReview, landlordApprovedVersion: undefined, tenantApprovedVersion: undefined },
    'agreement-updated',
    `Agreement updated to Version ${version}`,
    undefined,
    timestamp,
  )
  return {
    ...agreement,
    clauses,
    agreementBuilder,
    agreementVersion: version,
    landlord: { ...clearExecutionVerification(agreement.landlord), approvedAgreement: false },
    tenant: { ...clearExecutionVerification(agreement.tenant), approvedAgreement: false },
    review: nextReview,
  }
}

export function approveCurrentVersion(agreement: AgreementState, timestamp = new Date().toISOString()): AgreementState {
  const review = resolveReviewState(agreement)
  if (agreement.finalized || review.proposals.some((proposal) => proposal.status === 'pending')) return agreement
  const role = review.currentRole
  const name = agreement[role].name
  const approvalField = role === 'landlord' ? 'landlordApprovedVersion' : 'tenantApprovedVersion'
  const approved = addEvent({ ...review, [approvalField]: agreement.agreementVersion }, 'party-approved', `${name} approved Version ${agreement.agreementVersion}`, role, timestamp)
  return { ...agreement, [role]: { ...agreement[role], approvedAgreement: true }, review: approved }
}

export function canFinalizeAgreement(agreement: AgreementState): boolean {
  const review = resolveReviewState(agreement)
  return !agreement.finalized &&
    !review.proposals.some((proposal) => proposal.status === 'pending') &&
    review.landlordApprovedVersion === agreement.agreementVersion &&
    review.tenantApprovedVersion === agreement.agreementVersion
}

export function finalizeReviewedAgreement(agreement: AgreementState, timestamp = new Date().toISOString()): AgreementState {
  if (!canFinalizeAgreement(agreement)) return agreement
  const review = resolveReviewState(agreement)
  return {
    ...agreement,
    finalized: true,
    finalizedBy: review.currentRole,
    finalizedAt: timestamp,
    workflowStep: 'finalized',
    review: addEvent({ ...review, finalizedVersion: agreement.agreementVersion }, 'agreement-finalized', `Version ${agreement.agreementVersion} finalized for execution`, review.currentRole, timestamp),
  }
}
