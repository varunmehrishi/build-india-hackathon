import { useEffect, useRef, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { resolveNotarizationStatus } from '../../domain/notarization'
import {
  areAllSignaturesComplete,
  canEnterSigning,
  finalAgreementVersion,
  isDocumentUnchanged,
  signatureMatchesFinalAgreement,
} from '../../domain/signing'
import type { AgreementState, PartyRole } from '../../domain/types'
import { DocumentIntegrity } from './DocumentIntegrity'
import { FinalAgreementPreview } from './FinalAgreementPreview'

interface ESignScreenProps {
  agreement: AgreementState
  signingRole: PartyRole
  onPrepare: () => Promise<void>
  onSign: (role: PartyRole) => Promise<boolean>
  onCancel: (role: PartyRole) => void
  onContinue: () => void
  onOpenOtherParty?: () => void
}

type View = 'ready' | 'ceremony' | 'cancelled' | 'success' | 'progress'

const ceremonySteps = [
  'Verifying signing request…',
  'Creating digital signature…',
  'Applying signature to the final version…',
  'Verifying signed document…',
]

function roleLabel(role: PartyRole): string {
  return role === 'landlord' ? 'Landlord' : 'Tenant'
}

function otherRole(role: PartyRole): PartyRole {
  return role === 'landlord' ? 'tenant' : 'landlord'
}

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(timestamp))
}

export function ESignScreen({ agreement, signingRole, onPrepare, onSign, onCancel, onContinue, onOpenOtherParty }: ESignScreenProps) {
  const signature = agreement[signingRole === 'landlord' ? 'landlordSignature' : 'tenantSignature']
  const [consented, setConsented] = useState(false)
  const [view, setView] = useState<View>(signature ? 'progress' : 'ready')
  const [completedSteps, setCompletedSteps] = useState(0)
  const [isSigning, setIsSigning] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [integrity, setIntegrity] = useState<boolean | null>(null)
  const cancelled = useRef(false)
  const version = finalAgreementVersion(agreement)
  const counterpart = otherRole(signingRole)
  const counterpartSignature = agreement[counterpart === 'landlord' ? 'landlordSignature' : 'tenantSignature']
  const complete = areAllSignaturesComplete(agreement)

  useEffect(() => {
    if (!agreement.finalDocumentHash && canEnterSigning(agreement)) void onPrepare()
  }, [agreement, onPrepare])

  useEffect(() => {
    cancelled.current = false
    return () => { cancelled.current = true }
  }, [])

  useEffect(() => {
    let active = true
    if (!agreement.finalDocumentHash) return
    void isDocumentUnchanged(agreement).then((result) => { if (active) setIntegrity(result) })
    return () => { active = false }
  }, [agreement])

  async function runCeremony() {
    if (isSigning || integrity !== true) return
    cancelled.current = false
    setIsSigning(true)
    for (let index = 0; index < ceremonySteps.length; index += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 275))
      if (cancelled.current) return
      setCompletedSteps(index + 1)
    }
    const signed = await onSign(signingRole)
    if (!cancelled.current) {
      setIsSigning(false)
      setView(signed ? 'success' : 'cancelled')
    }
  }

  function cancelCeremony() {
    cancelled.current = true
    setCompletedSteps(0)
    setIsSigning(false)
    setView('cancelled')
    onCancel(signingRole)
  }

  if (!canEnterSigning(agreement)) {
    return <Card className="esign-card"><p className="eyebrow">eSign unavailable</p><h1>Complete the execution checks first</h1><p className="stage-description">Finalization, stamp duty, both identity checks, and the optional notarisation decision must be complete before signing.</p></Card>
  }

  if (!agreement.finalDocumentHash || !agreement.documentId || integrity === null) {
    return <Card className="esign-card esign-loading" role="status"><div className="esign-pulse" aria-hidden="true">SS</div><div><p className="eyebrow">Secure eSign</p><h1>Preparing the final document…</h1><p>The browser is creating its SHA-256 fingerprint.</p></div></Card>
  }

  if (integrity === false || (counterpartSignature && !signatureMatchesFinalAgreement(agreement, counterpartSignature))) {
    return <Card className="esign-card esign-blocked" role="alert"><p className="eyebrow">Signing paused</p><h1>This agreement changed after the previous signature.</h1><p>The document must be reviewed and signed again. Saral Setu will not combine signatures from different document versions or fingerprints.</p><DocumentIntegrity agreement={agreement} open /></Card>
  }

  if (complete && view !== 'success') {
    return (
      <div className="esign-screen">
        <Card className="esign-card esign-complete-card">
          <div className="esign-success-mark" aria-hidden="true">✓</div>
          <p className="eyebrow">Demo eSign</p><h1>All signatures complete</h1>
          <p className="lede">Both parties have signed the same finalized version of the agreement.</p>
          <div className="esign-party-progress">
            {(['tenant', 'landlord'] as const).map((role) => <span key={role}><small>{roleLabel(role)}</small><strong>{agreement[role].name}</strong><em>Signed Version {version} ✓</em></span>)}
          </div>
          <DocumentIntegrity agreement={agreement} open />
          <div className="esign-actions"><Button variant="secondary" onClick={() => setShowPreview(true)}>View Signed Agreement</Button><Button onClick={onContinue}>Continue</Button></div>
        </Card>
        {showPreview ? <FinalAgreementPreview agreement={agreement} onClose={() => setShowPreview(false)} /> : null}
      </div>
    )
  }

  if (view === 'success' && signatureMatchesFinalAgreement(agreement, signature) && signature) {
    return (
      <Card className="esign-card esign-complete-card">
        <div className="esign-success-mark" aria-hidden="true">✓</div><p className="eyebrow">Demo eSign</p><h1>Signed successfully</h1>
        <div className="esign-signed-evidence"><strong>{signature.signerName}</strong><span>{roleLabel(signature.signerRole)}</span><span>Version {signature.signedVersion}</span><span>{formatDateTime(signature.signedAt)}</span><small>{signature.signatureReference}</small></div>
        <Button onClick={() => setView('progress')}>{complete ? 'View completion' : 'View signing progress'}</Button>
      </Card>
    )
  }

  if (view === 'progress' || signatureMatchesFinalAgreement(agreement, signature)) {
    return (
      <Card className="esign-card">
        <div className="section-heading"><p className="eyebrow">Demo eSign</p><h1>Signing progress</h1><p className="stage-description">Each signature is tied to Version {version} and Document ID {agreement.documentId}.</p></div>
        <div className="esign-party-progress">
          {(['tenant', 'landlord'] as const).map((role) => {
            const signed = signatureMatchesFinalAgreement(agreement, agreement[role === 'tenant' ? 'tenantSignature' : 'landlordSignature'])
            return <span key={role}><small>{roleLabel(role)}</small><strong>{agreement[role].name}</strong><em>{signed ? 'Identity verified ✓ · Signed ✓' : 'Identity verified ✓ · Waiting for signature'}</em></span>
          })}
        </div>
        <DocumentIntegrity agreement={agreement} />
        {!complete ? (onOpenOtherParty ? <Button onClick={onOpenOtherParty}>View as {roleLabel(counterpart)}</Button> : <p className="muted">Send this party’s completed action to the shared agreement, then continue in the original demo.</p>) : <Button onClick={() => setView('ready')}>View completion</Button>}
      </Card>
    )
  }

  if (view === 'cancelled') {
    return <Card className="esign-card esign-cancelled"><p className="eyebrow">Demo eSign</p><h1>Signature not completed</h1><p>Your agreement has not been changed. No signature was applied.</p><Button onClick={() => { setView('ready'); setCompletedSteps(0); setConsented(false) }}>Try again</Button></Card>
  }

  if (view === 'ceremony') {
    return (
      <Card className="esign-card esign-ceremony-card">
        <div className="esign-secure-mark" aria-hidden="true">SS</div><p className="eyebrow">Demo signing ceremony</p><h1>Secure eSign</h1>
        <div className="esign-ceremony-summary"><strong>{agreement[signingRole].name}</strong><span>{roleLabel(signingRole)} · Identity verified ✓</span><small>You are signing</small><h2>Residential Rent Agreement</h2><span>Version {version}</span><span>Document ID {agreement.documentId}</span></div>
        {!isSigning ? (
          <div className="esign-actions"><Button onClick={() => void runCeremony()}>Confirm &amp; Sign</Button><Button variant="ghost" onClick={cancelCeremony}>Cancel</Button></div>
        ) : (
          <><ol className="esign-ceremony-steps" aria-live="polite">{ceremonySteps.map((step, index) => <li key={step} className={index < completedSteps ? 'done' : index === completedSteps ? 'active' : ''}><span>{index < completedSteps ? '✓' : index === completedSteps ? '•' : '○'}</span>{step}</li>)}</ol><Button variant="ghost" onClick={cancelCeremony}>Cancel</Button></>
        )}
      </Card>
    )
  }

  const notaryStatus = resolveNotarizationStatus(agreement)
  return (
    <div className="esign-screen">
      <Card className="esign-card">
        <header className="esign-heading"><div><p className="eyebrow">Demo eSign</p><h1>Ready to sign</h1><p className="lede">You are signing this exact finalized document.</p></div><Badge tone="success">Final document</Badge></header>
        <div className="esign-ready-grid">
          <span><small>Agreement</small><strong>Residential Rent Agreement</strong><em>{agreement.property.city}, {agreement.property.state}</em></span>
          <span><small>Final version</small><strong>Version {version}</strong><em>Finalized ✓</em></span>
          <span><small>Signing as</small><strong>{agreement[signingRole].name}</strong><em>{roleLabel(signingRole)} · Identity verified ✓</em></span>
          <span><small>Stamp duty</small><strong>Completed ✓</strong></span>
          <span><small>Notarial attestation</small><strong>{notaryStatus === 'completed' ? 'Completed ✓' : 'Skipped'}</strong></span>
        </div>
        {counterpartSignature ? <p className="esign-same-version-note">{roleLabel(counterpart)} signed this version ✓<br /><strong>You are about to sign the same finalized document.</strong></p> : null}
        <Button variant="secondary" onClick={() => setShowPreview(true)}>Review Final Agreement</Button>
        <details className="esign-details"><summary>Document details</summary><div className="esign-detail-list"><span><small>Version</small><strong>{version}</strong></span><span><small>Document ID</small><strong>{agreement.documentId}</strong></span><span className="wide"><small>SHA-256</small><code>{agreement.finalDocumentHash}</code></span></div></details>
        <label className="esign-consent"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /><span><strong>I have reviewed and agree to the final document</strong><small>My Demo eSign will be recorded against Version {version} and this document fingerprint.</small></span></label>
        <Button onClick={() => setView('ceremony')} disabled={!consented}>Continue to eSign</Button>
      </Card>
      {showPreview ? <FinalAgreementPreview agreement={agreement} onClose={() => setShowPreview(false)} /> : null}
    </div>
  )
}
