import { useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import {
  deriveCompletionSummary,
  downloadExecutionRecord,
  downloadSignedAgreement,
} from '../../domain/completion'
import { resolveNotarizationStatus } from '../../domain/notarization'
import { isDocumentUnchanged, signatureMatchesFinalAgreement } from '../../domain/signing'
import type { AgreementState } from '../../domain/types'
import { FinalAgreementPreview } from '../signing/FinalAgreementPreview'
import { AuditTrail } from './AuditTrail'
import { CompletionDialog } from './CompletionDialog'
import { EmailAgreementDialog } from './EmailAgreementDialog'
import { ExecutionRecord } from './ExecutionRecord'

interface CompletionPageProps {
  agreement: AgreementState
  onCreateAnother: () => void
  getShareUrl: () => string
}

type Modal = 'agreement' | 'email' | 'record' | 'audit' | 'verify' | null

function formatDate(timestamp?: string): string {
  if (!timestamp) return 'Not recorded'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(timestamp))
}

export function CompletionPage({ agreement, onCreateAnother, getShareUrl }: CompletionPageProps) {
  const [modal, setModal] = useState<Modal>(null)
  const [integrityCheck, setIntegrityCheck] = useState<{ hash?: string; result: boolean } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const summary = deriveCompletionSummary(agreement)
  const notary = resolveNotarizationStatus(agreement)
  const integrity = integrityCheck && integrityCheck.hash === agreement.finalDocumentHash
    ? integrityCheck.result
    : null

  useEffect(() => {
    let active = true
    const hash = agreement.finalDocumentHash
    void isDocumentUnchanged(agreement).then((result) => { if (active) setIntegrityCheck({ hash, result }) })
    return () => { active = false }
  }, [agreement])

  async function shareDocument() {
    let shareUrl: string
    try {
      shareUrl = getShareUrl()
    } catch {
      setAnnouncement('This demo agreement is too large to share as a link.')
      return
    }
    const text = `Residential Rent Agreement\nDocument ID: ${summary.documentId}\nOpen this link to import the signed demo state in Saral Setu.`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Residential Rent Agreement', text, url: shareUrl })
        setAnnouncement('Document reference shared.')
      } else {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
        setAnnouncement('Signed agreement link copied.')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(`${text}\n${shareUrl}`)
        setAnnouncement('Signed agreement link copied.')
      } catch {
        setAnnouncement('Sharing is not available in this browser.')
      }
    }
  }

  if (integrity === null) {
    return <Card className="completion-loading" role="status"><div className="completion-success-mark" aria-hidden="true">SS</div><div><p className="eyebrow">Completion</p><h1>Checking your final document…</h1><p>Confirming that both signatures match the finalized agreement.</p></div></Card>
  }

  if (!summary.complete || !integrity) {
    return (
      <Card className="completion-incomplete" role="alert">
        <p className="eyebrow">Completion paused</p>
        <h1>Your agreement is not ready to close yet</h1>
        <p>Saral Setu could not confirm every required execution record. The completion receipt will appear only after all checks pass.</p>
        <ul>
          <li className={agreement.finalized ? 'done' : ''}>Agreement finalized</li>
          <li className={summary.stampCompleted ? 'done' : ''}>Stamp duty completed</li>
          <li className={summary.identitiesVerified ? 'done' : ''}>Both identities verified</li>
          <li className={summary.landlordSigned && summary.tenantSigned ? 'done' : ''}>Both signatures recorded</li>
          <li className={integrity ? 'done' : ''}>Current document matches signed copy</li>
        </ul>
      </Card>
    )
  }

  return (
    <div className="completion-page">
      <Card className="completion-hero">
        <div className="completion-success-mark" aria-hidden="true">✓</div>
        <div className="completion-hero-heading"><div><p className="eyebrow">Agreement completed</p><h1>Your rent agreement is complete</h1><p className="lede">Both parties have signed the same final agreement.</p></div><Badge tone="success">Document unchanged ✓</Badge></div>
        <div className="completion-agreement-name"><strong>Residential Rent Agreement</strong><span>{agreement.property.city}, {agreement.property.state}</span></div>
        <dl className="completion-meta">
          <div><dt>Landlord</dt><dd>{agreement.landlord.name}</dd></div>
          <div><dt>Tenant</dt><dd>{agreement.tenant.name}</dd></div>
          <div><dt>Term</dt><dd>{agreement.durationMonths} months</dd></div>
          <div><dt>Version</dt><dd>{summary.finalizedVersion}</dd></div>
          <div><dt>Completed</dt><dd>{formatDate(summary.completedAt)}</dd></div>
          <div className="document-id"><dt>Document ID</dt><dd>{summary.documentId}</dd></div>
        </dl>
        <div className="completion-primary-actions">
          <Button onClick={() => { downloadSignedAgreement(agreement); setAnnouncement('Signed agreement download started.') }}>Download Agreement</Button>
          <Button variant="secondary" onClick={() => setModal('email')}>Email Agreement</Button>
          <Button variant="secondary" onClick={() => void shareDocument()}>Share</Button>
          <Button variant="ghost" onClick={() => setModal('agreement')}>View Agreement</Button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
        {announcement ? <p className="completion-action-feedback" aria-hidden="true">{announcement}</p> : null}
      </Card>

      <section className="completion-section" aria-labelledby="execution-summary-title">
        <div className="section-heading"><p className="eyebrow">Receipt</p><h2 id="execution-summary-title">Agreement execution</h2></div>
        <Card className="completion-checklist"><ul>
          <li><span>Agreement finalized</span><strong>Completed ✓</strong></li>
          <li><span>Stamp duty</span><strong>{agreement.requirements.stampDutyAmount === 0 ? 'Not required' : 'Completed ✓'}</strong></li>
          <li><span>Tenant identity verified</span><strong>Verified ✓</strong></li>
          <li><span>Landlord identity verified</span><strong>Verified ✓</strong></li>
          <li><span>Notarial attestation</span><strong>{notary === 'completed' ? 'Completed ✓' : 'Not selected'}</strong></li>
          <li><span>Tenant signed</span><strong>Signed Version {agreement.tenantSignature?.signedVersion} ✓</strong></li>
          <li><span>Landlord signed</span><strong>Signed Version {agreement.landlordSignature?.signedVersion} ✓</strong></li>
          <li><span>Document integrity</span><strong>Verified ✓</strong></li>
          <li><span>Registration</span><strong>{agreement.requirements.registrationRequired ? 'Required' : 'Not required for this demo'}</strong></li>
        </ul></Card>
      </section>

      <section className="completion-section" aria-labelledby="documents-title">
        <div className="section-heading"><p className="eyebrow">Handoff</p><h2 id="documents-title">Your documents</h2></div>
        <div className="completion-document-grid">
          <Card className="completion-document-card"><span className="completion-document-icon" aria-hidden="true">01</span><div><h3>Signed Agreement</h3><p>Final agreement signed by both parties.</p></div><div className="completion-card-actions"><Button variant="secondary" onClick={() => setModal('agreement')}>View</Button><Button variant="ghost" onClick={() => { downloadSignedAgreement(agreement); setAnnouncement('Signed agreement download started.') }}>Download</Button></div></Card>
          <Card className="completion-document-card"><span className="completion-document-icon" aria-hidden="true">02</span><div><h3>Execution Record</h3><p>Verification, signatures, document integrity, and audit history.</p></div><div className="completion-card-actions"><Button variant="secondary" onClick={() => setModal('record')}>View</Button><Button variant="ghost" onClick={() => { void downloadExecutionRecord(agreement).then(() => setAnnouncement('Execution record download started.')) }}>Download</Button></div></Card>
        </div>
      </section>

      <section className="completion-section completion-more" aria-labelledby="completion-more-title">
        <div className="section-heading"><p className="eyebrow">Evidence</p><h2 id="completion-more-title">Review the record</h2></div>
        <div className="completion-secondary-actions"><Button variant="ghost" onClick={() => setModal('audit')}>View Audit Trail</Button><Button variant="ghost" onClick={() => setModal('verify')}>Verify Document</Button></div>
      </section>

      <Card className="completion-done-card">
        <div><p className="eyebrow">You’re done</p><h2>Keep a copy for your records</h2><p>Both parties signed the same finalized version. {agreement.requirements.registrationRequired ? 'Review the registration requirement shown for this transaction.' : 'No additional registration step is required for this demo transaction.'}</p></div>
        <Button variant="secondary" onClick={onCreateAnother}>Create another document</Button>
      </Card>

      {modal === 'agreement' ? <FinalAgreementPreview agreement={agreement} onClose={() => setModal(null)} /> : null}
      {modal === 'email' ? <EmailAgreementDialog agreement={agreement} onClose={() => setModal(null)} /> : null}
      {modal === 'record' ? <CompletionDialog title="Execution Record" eyebrow="Document evidence" wide onClose={() => setModal(null)}><ExecutionRecord agreement={agreement} integrity={integrity} /><div className="completion-dialog-actions"><Button onClick={() => void downloadExecutionRecord(agreement)}>Download Execution Record</Button></div></CompletionDialog> : null}
      {modal === 'audit' ? <CompletionDialog title="Audit Trail" eyebrow="Agreement history" wide onClose={() => setModal(null)}><AuditTrail agreement={agreement} /></CompletionDialog> : null}
      {modal === 'verify' ? <CompletionDialog title="Document integrity" eyebrow="Verify document" onClose={() => setModal(null)}><div className="completion-verification"><div><small>Document ID</small><strong>{summary.documentId}</strong></div><div><small>Agreement version</small><strong>{summary.finalizedVersion}</strong></div><div><span>Tenant signed this version</span><strong>{signatureMatchesFinalAgreement(agreement, agreement.tenantSignature) ? '✓' : 'No'}</strong></div><div><span>Landlord signed this version</span><strong>{signatureMatchesFinalAgreement(agreement, agreement.landlordSignature) ? '✓' : 'No'}</strong></div><div><span>Current document matches signed copy</span><strong>{integrity ? '✓' : 'No'}</strong></div><details><summary>Technical details</summary><small>SHA-256</small><code>{agreement.finalDocumentHash}</code></details></div></CompletionDialog> : null}
    </div>
  )
}
