import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import type { AgreementState, PartyRole } from '../../domain/types'

interface FinalizedViewProps {
  agreement: AgreementState
  localRole?: PartyRole
}

function roleLabel(role: PartyRole | undefined): string {
  return role === 'landlord' ? 'Landlord' : 'Tenant'
}

export function FinalizedView({ agreement, localRole }: FinalizedViewProps) {
  const finalizedBy = agreement.finalizedBy ?? agreement.lastUpdatedBy ?? agreement.initiator
  return (
    <div className="finalized-content">
      <Card className="finalized-card">
        <div className="finalized-heading">
          <div>
            <p className="eyebrow">Locked document</p>
            <h1>Finalized agreement</h1>
            <p className="lede">
              Finalized by the {roleLabel(finalizedBy).toLocaleLowerCase('en-IN')}. This point-in-time document is read-only.
            </p>
          </div>
          <Badge tone="success">Finalized</Badge>
        </div>

        <div className="document-meta">
          <span><small>Your role</small><strong>{localRole ? roleLabel(localRole) : 'Not assigned'}</strong></span>
          <span><small>Version</small><strong>{agreement.agreementVersion}</strong></span>
        </div>

        <section className="finalized-section">
          <p className="eyebrow">Parties</p>
          <div className="party-grid">
            <div><small>Landlord</small><strong>{agreement.landlord.name}</strong></div>
            <div><small>Tenant</small><strong>{agreement.tenant.name}</strong></div>
          </div>
        </section>

        <section className="finalized-section">
          <p className="eyebrow">Property and term</p>
          <h2>{agreement.property.address}</h2>
          <p className="muted">{agreement.property.city}, {agreement.property.state} · {agreement.durationMonths} months from {agreement.startDate}</p>
          <div className="party-grid">
            <div><small>Monthly rent</small><strong>₹{agreement.monthlyRent.toLocaleString('en-IN')}</strong></div>
            <div><small>Security deposit</small><strong>₹{agreement.securityDeposit.toLocaleString('en-IN')}</strong></div>
          </div>
        </section>

        <section className="finalized-section">
          <p className="eyebrow">Terms</p>
          <div className="clause-list">
            {agreement.clauses.map((clause) => (
              <article key={clause.id}>
                <strong>{clause.title}</strong>
                <p>{clause.text}</p>
              </article>
            ))}
          </div>
        </section>
      </Card>
    </div>
  )
}
