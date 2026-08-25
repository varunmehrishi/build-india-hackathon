import { describe, expect, it } from 'vitest'
import { generateAgreement } from './agreementBuilder'
import { createInitialAgreementState } from './demoData'
import {
  approveCurrentVersion,
  canFinalizeAgreement,
  createProposal,
  explainClause,
  finalizeReviewedAgreement,
  resolveProposal,
  resolveReviewState,
} from './review'

function reviewAgreement() {
  const agreement = createInitialAgreementState()
  agreement.intakeCompleted = true
  agreement.landlord.name = 'Arjun Rao'
  agreement.tenant.name = 'Meera Sharma'
  agreement.property.address = '24A, Lotus Heights'
  agreement.property.city = 'Bengaluru'
  agreement.property.state = 'Karnataka'
  agreement.monthlyRent = 40_000
  agreement.securityDeposit = 120_000
  agreement.durationMonths = 11
  agreement.startDate = '2026-09-01'
  agreement.clauses = generateAgreement(agreement).clauses
  agreement.workflowStep = 'review'
  return agreement
}

describe('agreement review', () => {
  it('explains the selected deposit clause in plain language', () => {
    const agreement = reviewAgreement()
    const clause = agreement.clauses.find((item) => item.id === 'security-deposit-refund')!
    const explanation = explainClause(clause, 'What does this mean?')
    expect(explanation.summary).toContain('30 days')
    expect(explanation.keyPoints).toContain('Normal wear and tear is not treated as damage.')
  })

  it('creates a pending proposal without changing the agreement', () => {
    let agreement = reviewAgreement()
    agreement.review = { ...resolveReviewState(agreement), currentRole: 'tenant', selectedClauseId: 'security-deposit-refund' }
    const oldText = agreement.clauses.find((item) => item.id === 'security-deposit-refund')!.text
    agreement = createProposal(agreement, 'security-deposit-refund', 'Can we make this 7 days instead?', '2026-08-25T14:00:00.000Z')
    expect(agreement.review?.proposals[0]).toMatchObject({ proposedBy: 'tenant', status: 'pending', summary: 'Deposit refund 30 days → 7 days' })
    expect(agreement.clauses.find((item) => item.id === 'security-deposit-refund')?.text).toBe(oldText)
  })

  it('only lets the other party accept and applies the structured change as Version 2', () => {
    let agreement = reviewAgreement()
    agreement.review = { ...resolveReviewState(agreement), currentRole: 'tenant', selectedClauseId: 'security-deposit-refund' }
    agreement = createProposal(agreement, 'security-deposit-refund', 'Can we make this 7 days instead?')
    const proposalId = agreement.review!.proposals[0].id
    expect(resolveProposal(agreement, proposalId, 'accepted')).toBe(agreement)

    agreement = { ...agreement, review: { ...agreement.review!, currentRole: 'landlord' } }
    agreement = resolveProposal(agreement, proposalId, 'accepted', '2026-08-25T14:01:00.000Z')
    expect(agreement.agreementVersion).toBe(2)
    expect(agreement.agreementBuilder?.deposit.refundDays).toBe(7)
    expect(agreement.clauses.find((item) => item.id === 'security-deposit-refund')?.text).toContain('within 7 days')
    expect(agreement.review?.proposals[0].status).toBe('accepted')
  })

  it('does not change the clause or version when a proposal is rejected', () => {
    let agreement = reviewAgreement()
    agreement.review = { ...resolveReviewState(agreement), currentRole: 'tenant', selectedClauseId: 'security-deposit-refund' }
    agreement = createProposal(agreement, 'security-deposit-refund', 'Can we make this 7 days instead?')
    const proposalId = agreement.review!.proposals[0].id
    agreement = { ...agreement, review: { ...agreement.review!, currentRole: 'landlord' } }
    agreement = resolveProposal(agreement, proposalId, 'rejected')
    expect(agreement.agreementVersion).toBe(1)
    expect(agreement.clauses.find((item) => item.id === 'security-deposit-refund')?.text).toContain('within 30 days')
  })

  it('requires both parties to approve the current version before finalization', () => {
    let agreement = reviewAgreement()
    agreement.review = { ...resolveReviewState(agreement), currentRole: 'tenant' }
    agreement = approveCurrentVersion(agreement)
    expect(canFinalizeAgreement(agreement)).toBe(false)
    agreement = { ...agreement, review: { ...agreement.review!, currentRole: 'landlord' } }
    agreement = approveCurrentVersion(agreement)
    expect(canFinalizeAgreement(agreement)).toBe(true)
    agreement = finalizeReviewedAgreement(agreement, '2026-08-25T14:02:00.000Z')
    expect(agreement.finalized).toBe(true)
    expect(agreement.workflowStep).toBe('finalized')
    expect(agreement.review?.finalizedVersion).toBe(1)
  })

  it('invalidates both approvals after a later accepted change', () => {
    let agreement = reviewAgreement()
    agreement.review = { ...resolveReviewState(agreement), currentRole: 'tenant' }
    agreement = approveCurrentVersion(agreement)
    agreement = { ...agreement, review: { ...agreement.review!, currentRole: 'landlord' } }
    agreement = approveCurrentVersion(agreement)
    agreement = { ...agreement, review: { ...agreement.review!, currentRole: 'tenant' } }
    agreement = createProposal(agreement, 'security-deposit-refund', 'Can we make this 7 days instead?')
    const proposalId = agreement.review!.proposals[0].id
    agreement = { ...agreement, review: { ...agreement.review!, currentRole: 'landlord' } }
    agreement = resolveProposal(agreement, proposalId, 'accepted')
    expect(agreement.review?.landlordApprovedVersion).toBeUndefined()
    expect(agreement.review?.tenantApprovedVersion).toBeUndefined()
    expect(agreement.landlord.approvedAgreement).toBe(false)
    expect(agreement.tenant.approvedAgreement).toBe(false)
  })
})
