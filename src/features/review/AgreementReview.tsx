import { useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Textarea } from '../../components/ui/Textarea'
import {
  approveCurrentVersion,
  canFinalizeAgreement,
  createProposal,
  explainClause,
  previewProposal,
  resolveProposal,
  resolveReviewState,
  suggestedQuestions,
} from '../../domain/review'
import type { AgreementState, PartyRole, ProposedChange } from '../../domain/types'

interface AgreementReviewProps {
  agreement: AgreementState
  onChange: (agreement: AgreementState) => void
  onFinalize: () => void
}

function roleLabel(role: PartyRole): string {
  return role === 'tenant' ? 'Tenant' : 'Landlord'
}

function otherRole(role: PartyRole): PartyRole {
  return role === 'tenant' ? 'landlord' : 'tenant'
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp))
}

function ProposalDiff({ proposal }: { proposal: ProposedChange }) {
  return (
    <details className="review-diff">
      <summary>View exact wording</summary>
      <p className="diff-old"><span>−</span>{proposal.oldText}</p>
      <p className="diff-new"><span>+</span>{proposal.newText}</p>
    </details>
  )
}

export function AgreementReview({ agreement, onChange, onFinalize }: AgreementReviewProps) {
  const review = resolveReviewState(agreement)
  const selectedClause = agreement.clauses.find((clause) => clause.id === review.selectedClauseId) ?? agreement.clauses[0]
  const [question, setQuestion] = useState('')
  const [askedQuestion, setAskedQuestion] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const explanation = useMemo(
    () => selectedClause && askedQuestion ? explainClause(selectedClause, askedQuestion) : null,
    [askedQuestion, selectedClause],
  )
  const proposalPreview = selectedClause ? previewProposal(selectedClause, askedQuestion) : null
  const pending = review.proposals.filter((proposal) => proposal.status === 'pending')
  const resolved = review.proposals.length - pending.length
  const ready = canFinalizeAgreement(agreement)
  const currentRole = review.currentRole
  const currentApproval = currentRole === 'landlord' ? review.landlordApprovedVersion : review.tenantApprovedVersion

  function updateReview(values: Partial<typeof review>) {
    onChange({ ...agreement, review: { ...review, ...values } })
  }

  function selectClause(clauseId: string) {
    updateReview({ selectedClauseId: clauseId })
    setQuestion('')
    setAskedQuestion('')
    setPanelOpen(true)
  }

  function askQuestion() {
    if (!question.trim()) return
    setAskedQuestion(question.trim())
  }

  function proposeChange() {
    if (!selectedClause || !askedQuestion || !proposalPreview) return
    onChange(createProposal(agreement, selectedClause.id, askedQuestion))
    setQuestion('')
    setAskedQuestion('')
  }

  return (
    <div className="agreement-review-screen">
      <header className="review-page-heading">
        <div>
          <p className="eyebrow">Understand it. Agree on it. Then sign it.</p>
          <h1>Review together</h1>
          <p className="lede">Read each clause, ask a plain-language question, and agree on one final version before execution.</p>
        </div>
        <div className="review-role-control">
          <label htmlFor="review-role">Viewing as</label>
          <select
            id="review-role"
            value={currentRole}
            onChange={(event) => updateReview({ currentRole: event.target.value as PartyRole })}
          >
            <option value="tenant">{agreement.tenant.name} — Tenant</option>
            <option value="landlord">{agreement.landlord.name} — Landlord</option>
          </select>
        </div>
      </header>

      <div className="review-status-bar">
        <span><small>Agreement</small><strong>Version {agreement.agreementVersion}</strong></span>
        <span><small>Open changes</small><strong>{pending.length}</strong></span>
        <span><small>Resolved</small><strong>{resolved}</strong></span>
        {!pending.length ? <Badge tone="success">All changes resolved</Badge> : <Badge tone="warning">Review needed</Badge>}
      </div>

      <div className="agreement-review-grid">
        <Card className="review-document-card">
          <div className="review-document-heading">
            <div><p className="document-kicker">Agreement · Version {agreement.agreementVersion}</p><h2>Residential Rent Agreement</h2></div>
            <Badge tone="accent">Select a clause</Badge>
          </div>
          <p className="document-intro">For the residential premises at {agreement.property.address}, {agreement.property.city}.</p>
          <div className="review-clause-list">
            {agreement.clauses.map((clause, index) => (
              <button
                type="button"
                key={clause.id}
                className={clause.id === selectedClause?.id ? 'review-clause selected' : 'review-clause'}
                aria-pressed={clause.id === selectedClause?.id}
                onClick={() => selectClause(clause.id)}
              >
                <span>{index + 1}</span>
                <span><strong>{clause.title}</strong><small>{clause.text}</small></span>
              </button>
            ))}
          </div>
          {agreement.agreementBuilder?.furnishing.level !== 'unfurnished' && agreement.agreementBuilder?.furnishing.inventory.length ? (
            <section className="review-schedule">
              <h3>Schedule A — Furnishings, Fixtures &amp; Inventory</h3>
              <p>{agreement.agreementBuilder.furnishing.inventory.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}</p>
            </section>
          ) : null}
        </Card>

        <aside className={panelOpen ? 'review-panel open' : 'review-panel'} aria-label="Clause review">
          <div className="review-panel-mobile-header">
            <strong>Review selected clause</strong>
            <button type="button" onClick={() => setPanelOpen(false)} aria-label="Close clause review">×</button>
          </div>
          {selectedClause ? (
            <Card className="selected-clause-card">
              <div className="selected-clause-heading"><div><p className="eyebrow">Selected clause</p><h2>{selectedClause.title}</h2></div><Badge tone="accent">Clause</Badge></div>
              <blockquote>{selectedClause.text}</blockquote>
              <div className="suggested-questions">
                <strong>Suggested questions</strong>
                {suggestedQuestions(selectedClause.id).map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>{suggestion}</button>
                ))}
                {selectedClause.id === 'security-deposit-refund' ? (
                  <button type="button" onClick={() => setQuestion('Can we make this 7 days instead?')}>Can we make this 7 days instead?</button>
                ) : null}
              </div>
              <Textarea label="Ask about this clause" rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What does this mean?" />
              <Button variant="secondary" onClick={askQuestion} disabled={!question.trim()}>Ask Saral Setu</Button>

              {explanation ? (
                <div className="clause-explanation" role="status">
                  <p className="eyebrow">Saral Setu explains</p>
                  <p><strong>You asked:</strong> “{askedQuestion}”</p>
                  <p>{explanation.summary}</p>
                  {explanation.keyPoints?.length ? <ul>{explanation.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul> : null}
                  {proposalPreview ? (
                    <div className="proposal-preview">
                      <p className="eyebrow">Proposed change</p>
                      <strong>{proposalPreview.summary.replace('Deposit refund ', '')}</strong>
                      <p>This change is not applied until {agreement[otherRole(currentRole)].name} accepts it.</p>
                      <Button onClick={proposeChange}>Propose Change</Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}

          {review.proposals.length ? (
            <Card className="proposal-list-card">
              <div className="section-heading"><p className="eyebrow">Changes</p><h2>Proposed changes</h2></div>
              <div className="proposal-list">
                {[...review.proposals].reverse().map((proposal) => {
                  const clause = agreement.clauses.find((item) => item.id === proposal.clauseId)
                  const canRespond = proposal.status === 'pending' && proposal.proposedBy !== currentRole
                  return (
                    <article key={proposal.id} className={`proposal-card ${proposal.status}`}>
                      <div className="proposal-card-heading">
                        <Badge tone={proposal.status === 'pending' ? 'warning' : proposal.status === 'accepted' ? 'success' : 'neutral'}>{proposal.status}</Badge>
                        <small>{clause?.title ?? 'Agreement clause'}</small>
                      </div>
                      <strong>{proposal.summary.replace('Deposit refund ', '')}</strong>
                      <p>“{proposal.reason}”</p>
                      <small>Proposed by {agreement[proposal.proposedBy].name}</small>
                      <ProposalDiff proposal={proposal} />
                      {canRespond ? <div className="proposal-actions"><Button onClick={() => onChange(resolveProposal(agreement, proposal.id, 'accepted'))}>Accept</Button><Button variant="ghost" onClick={() => onChange(resolveProposal(agreement, proposal.id, 'rejected'))}>Reject</Button></div> : null}
                      {proposal.status === 'pending' && !canRespond ? <p className="waiting-copy">Waiting for {agreement[otherRole(proposal.proposedBy)].name}</p> : null}
                    </article>
                  )
                })}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>

      <div className="review-completion-grid">
        <Card className="approval-card">
          <div className="section-heading"><p className="eyebrow">Your review</p><h2>Approve the latest version</h2></div>
          {pending.length ? <p className="muted">Resolve all proposed changes before either party approves.</p> : null}
          <div className="approval-party-list">
            {(['tenant', 'landlord'] as const).map((role) => {
              const approvedVersion = role === 'tenant' ? review.tenantApprovedVersion : review.landlordApprovedVersion
              const approved = approvedVersion === agreement.agreementVersion
              return <span key={role}><span><small>{roleLabel(role)}</small><strong>{agreement[role].name}</strong></span><Badge tone={approved ? 'success' : 'neutral'}>{approved ? `Approved V${approvedVersion}` : 'Review pending'}</Badge></span>
            })}
          </div>
          {currentApproval === agreement.agreementVersion
            ? <p className="approval-confirmation">✓ {agreement[currentRole].name} approved Version {agreement.agreementVersion}</p>
            : <Button onClick={() => onChange(approveCurrentVersion(agreement))} disabled={Boolean(pending.length)}>Approve this version as {roleLabel(currentRole)}</Button>}
          {(review.landlordApprovedVersion || review.tenantApprovedVersion) && !ready && !pending.length ? <p className="muted">Both parties need to approve this exact version.</p> : null}
        </Card>

        <Card className={ready ? 'finalize-review-card ready' : 'finalize-review-card'}>
          <div className="section-heading"><p className="eyebrow">Final agreement</p><h2>{ready ? 'Ready to finalize' : 'Approval in progress'}</h2></div>
          <ul className="finalize-checklist">
            <li className={!pending.length ? 'done' : ''}>All proposed changes resolved</li>
            <li className={review.tenantApprovedVersion === agreement.agreementVersion ? 'done' : ''}>Tenant approved Version {agreement.agreementVersion}</li>
            <li className={review.landlordApprovedVersion === agreement.agreementVersion ? 'done' : ''}>Landlord approved Version {agreement.agreementVersion}</li>
          </ul>
          <p className="muted">Once finalized, this version will be locked and used for stamp duty and signing.</p>
          <Button onClick={onFinalize} disabled={!ready}>Finalize Agreement</Button>
        </Card>

        <Card className="review-history-card">
          <details open={review.events.length > 0}>
            <summary>Review activity ({review.events.length})</summary>
            {review.events.length ? <ol>{[...review.events].reverse().map((event) => <li key={event.id}><time>{formatTime(event.timestamp)}</time><span>{event.message}</span></li>)}</ol> : <p className="muted">Questions and decisions will appear here.</p>}
          </details>
        </Card>
      </div>
    </div>
  )
}
