import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { determineRequirements } from '../../domain/requirements'
import type { AgreementState, PartyRole } from '../../domain/types'

interface RequirementsScreenProps {
  agreement: AgreementState
}

const partyLabels: Record<PartyRole, string> = {
  landlord: 'Landlord',
  tenant: 'Tenant',
}

const journeyPreview = ['Agreement', 'Review', 'Stamp', 'Verify', 'Sign'] as const

export function RequirementsScreen({ agreement }: RequirementsScreenProps) {
  const requirements = determineRequirements(agreement)
  const signatureParties = requirements.signatures.parties.map((party) => partyLabels[party]).join(' + ')
  const notarizationStatus = requirements.notarization.required
    ? 'Required'
    : requirements.notarization.optional ? 'Optional' : 'Not required'

  return (
    <div className="requirements-content">
      <Card className="requirements-card">
        <div className="requirements-heading">
          <p className="eyebrow">Based on the details you provided</p>
          <h1>Here’s what your agreement needs</h1>
          <p className="lede">We’ve translated your tenancy details into a simple plan for completing this agreement.</p>
        </div>

        <div className="requirements-summary">
          <span className="requirements-summary-icon" aria-hidden="true">⌂</span>
          <span>
            <strong>Residential Rent Agreement</strong>
            <small>{agreement.property.city}, {agreement.property.state} · {agreement.durationMonths} months</small>
          </span>
        </div>

        <section className="requirements-list" aria-label="Agreement requirements">
          <article className="requirement-row">
            <span className="requirement-icon" aria-hidden="true">₹</span>
            <div className="requirement-copy">
              <div className="requirement-title"><h2>Stamp Duty</h2><Badge tone={requirements.stampDuty.required ? 'warning' : 'neutral'}>{requirements.stampDuty.required ? 'Required' : 'Not required'}</Badge></div>
              {requirements.stampDuty.required ? <strong className="requirement-value">₹{requirements.stampDuty.amount.toLocaleString('en-IN')}</strong> : null}
              <p>{requirements.stampDuty.required ? 'Stamp duty must be completed before execution.' : 'No stamp-duty payment is configured for this demo scenario.'}</p>
            </div>
          </article>

          <article className="requirement-row">
            <span className="requirement-icon" aria-hidden="true">✎</span>
            <div className="requirement-copy">
              <div className="requirement-title"><h2>Signatures</h2><Badge tone="warning">Required</Badge></div>
              <strong className="requirement-value">{signatureParties}</strong>
              <p>Both parties will sign the final agreement.</p>
            </div>
          </article>

          <article className="requirement-row">
            <span className="requirement-icon" aria-hidden="true">✓</span>
            <div className="requirement-copy">
              <div className="requirement-title"><h2>Notarisation</h2><Badge tone={requirements.notarization.required ? 'warning' : requirements.notarization.optional ? 'accent' : 'neutral'}>{notarizationStatus}</Badge></div>
              <p>{requirements.notarization.required ? 'Notarial attestation is included for this demo scenario.' : requirements.notarization.optional ? 'You can add notarial attestation during execution.' : 'Notarial attestation is not included for this demo scenario.'}</p>
            </div>
          </article>

          <article className="requirement-row">
            <span className="requirement-icon" aria-hidden="true">▤</span>
            <div className="requirement-copy">
              <div className="requirement-title"><h2>Registration</h2><Badge tone={requirements.registration.required ? 'warning' : 'neutral'}>{requirements.registration.required ? 'Required' : 'Not required'}</Badge></div>
              <p>{requirements.registration.required ? 'Registration is included for this demo transaction.' : 'Registration is not required for this demo scenario.'}</p>
            </div>
          </article>
        </section>

        <section className="journey-preview" aria-labelledby="journey-preview-heading">
          <div>
            <p className="eyebrow">Your path from here</p>
            <h2 id="journey-preview-heading">What happens next</h2>
          </div>
          <ol>
            {journeyPreview.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </section>
      </Card>
    </div>
  )
}
