import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { areBothPartiesVerified, isPartyVerifiedForVersion } from '../../domain/identityVerification'
import { DEMO_NOTARY, resolveNotarizationStatus } from '../../domain/notarization'
import type { AgreementState } from '../../domain/types'

interface NotarizationScreenProps {
  agreement: AgreementState
  onSkip: () => void
  onAttest: () => void
  onContinue: () => void
}

type SessionView = 'decision' | 'notary' | 'session'

function formatTime(timestamp?: string): string {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp))
}

export function NotarizationScreen({ agreement, onSkip, onAttest, onContinue }: NotarizationScreenProps) {
  const status = resolveNotarizationStatus(agreement)
  const [view, setView] = useState<SessionView>('decision')
  const bothVerified = areBothPartiesVerified(agreement)

  if (status === 'completed') {
    return (
      <Card className="notary-card notary-result-card">
        <div className="notary-success-mark" aria-hidden="true">✓</div>
        <div className="section-heading">
          <p className="eyebrow">Notarisation</p>
          <h1>Notarial attestation completed</h1>
          <p className="stage-description">The demo attestation is recorded against this agreement version.</p>
        </div>
        <div className="notary-completion-evidence">
          <span><small>Notary</small><strong>{agreement.notaryDisplayName ?? DEMO_NOTARY.displayName}</strong></span>
          <span><small>Registration</small><strong>{agreement.notaryRegistrationId ?? DEMO_NOTARY.registrationId}</strong></span>
          <span><small>Agreement</small><strong>Version {agreement.notarizedAgreementVersion ?? agreement.agreementVersion}</strong></span>
          <span><small>Timestamp</small><strong>{formatTime(agreement.notarizationCompletedAt)}</strong></span>
        </div>
        <Button onClick={onContinue}>Continue to Sign</Button>
      </Card>
    )
  }

  if (status === 'skipped') {
    return (
      <Card className="notary-card notary-result-card">
        <div className="notary-skip-mark" aria-hidden="true">→</div>
        <div className="section-heading">
          <p className="eyebrow">Notarisation</p>
          <h1>Notarisation skipped</h1>
          <p className="stage-description">No notarial attestation will be added to this agreement.</p>
        </div>
        <Button onClick={onContinue}>Continue to Sign</Button>
      </Card>
    )
  }

  if (view === 'decision') {
    return (
      <Card className="notary-card notary-decision-card">
        <div className="notary-icon" aria-hidden="true">N</div>
        <div className="section-heading">
          <p className="eyebrow">Execution checkpoint</p>
          <h1>Notarisation</h1>
          <h2>Optional for this agreement</h2>
          <p className="stage-description">A notary can independently attest the identity of the parties and execution of the agreement.</p>
        </div>
        <p className="notary-demo-note">This is an optional, simulated checkpoint for this demo agreement.</p>
        <div className="notary-actions">
          <Button onClick={() => setView('notary')}>Add Notarisation</Button>
          <Button variant="ghost" onClick={onSkip}>Skip</Button>
        </div>
      </Card>
    )
  }

  if (view === 'notary') {
    return (
      <Card className="notary-card">
        <header className="notary-heading">
          <div><p className="eyebrow">Notarisation</p><h1>Your Notary</h1></div>
          <Badge tone="success">Available now</Badge>
        </header>
        <section className="notary-profile" aria-label="Demo notary profile">
          <div className="notary-avatar" aria-hidden="true">AS</div>
          <div><h2>{DEMO_NOTARY.displayName}</h2><p>{DEMO_NOTARY.title}</p><small>Registration: {DEMO_NOTARY.registrationId}</small></div>
        </section>
        <p className="notary-demo-note">Synthetic demo profile. This is not a real notary or credential.</p>
        <div className="notary-actions">
          <Button onClick={() => setView('session')}>Join Session</Button>
          <Button variant="ghost" onClick={() => setView('decision')}>Back</Button>
        </div>
      </Card>
    )
  }

  const checkpoints = [
    ['Landlord', isPartyVerifiedForVersion(agreement.landlord, agreement.agreementVersion) ? '✓ Verified' : 'Not verified'],
    ['Tenant', isPartyVerifiedForVersion(agreement.tenant, agreement.agreementVersion) ? '✓ Verified' : 'Not verified'],
    ['Agreement', `Version ${agreement.agreementVersion}`],
    ['Stamp Duty', agreement.stampCompleted ? '✓ Completed' : 'Not completed'],
  ]

  return (
    <Card className="notary-card">
      <header className="notary-heading">
        <div><p className="eyebrow">Notary session</p><h1>Ready for attestation</h1></div>
        <Badge tone="accent">Demo checkpoint</Badge>
      </header>
      <section className="notary-session-profile">
        <div className="notary-avatar" aria-hidden="true">AS</div>
        <span><small>Selected notary</small><strong>{DEMO_NOTARY.displayName}</strong><small>{DEMO_NOTARY.registrationId}</small></span>
      </section>
      <div className="notary-checkpoints">
        {checkpoints.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}
      </div>
      {!bothVerified ? <p className="notary-blocked" role="alert">Both parties must be verified before attestation.</p> : null}
      <div className="notary-actions">
        <Button onClick={onAttest} disabled={!bothVerified}>Attest Agreement</Button>
        <Button variant="ghost" onClick={() => setView('notary')}>Leave Session</Button>
      </div>
    </Card>
  )
}
