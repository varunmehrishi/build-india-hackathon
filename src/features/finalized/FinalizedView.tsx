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
  const finalVersion = agreement.review?.finalizedVersion ?? agreement.agreementVersion
  return (
    <div className="finalized-content">
      <Card className="finalized-card">
        <div className="finalized-heading">
          <div>
            <p className="eyebrow">Locked document</p>
            <h1>Final agreement approved</h1>
            <p className="lede">
              Both parties agreed to Version {finalVersion}. The document is now locked for execution and remains read-only.
            </p>
          </div>
          <Badge tone="success">Finalized</Badge>
        </div>

        <div className="document-meta">
          <span><small>Your role</small><strong>{localRole ? roleLabel(localRole) : 'Not assigned'}</strong></span>
          <span><small>Final version</small><strong>Version {finalVersion}</strong></span>
          <span><small>Agreement ID</small><strong>{agreement.agreementId}</strong></span>
          <span><small>Finalized by</small><strong>{roleLabel(finalizedBy)}</strong></span>
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

        {agreement.agreementBuilder?.furnishing.level !== 'unfurnished' && agreement.agreementBuilder?.furnishing.inventory.length ? (
          <section className="finalized-section">
            <p className="eyebrow">Schedule A</p>
            <h2>Furnishings, fixtures and inventory</h2>
            <div className="clause-list">
              {agreement.agreementBuilder.furnishing.inventory.map((item) => (
                <article key={item.id}>
                  <strong>{item.quantity} × {item.name}</strong>
                  <p>{item.condition}{item.notes ? ` · ${item.notes}` : ''}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </Card>
    </div>
  )
}
