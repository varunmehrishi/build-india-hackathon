import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { resolveNotarizationStatus } from '../../domain/notarization'
import { stampDutyPaymentFor } from '../../domain/stampDuty'
import type { AgreementState, PartyRole, SignatureRecord } from '../../domain/types'
import { finalAgreementInventory, finalAgreementVersion, signatureMatchesFinalAgreement } from '../../domain/signing'

interface FinalAgreementPreviewProps {
  agreement: AgreementState
  onClose: () => void
}

function formatDate(timestamp?: string): string {
  if (!timestamp) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(timestamp))
}

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(timestamp))
}

function SignatureBlock({ agreement, role, signature }: {
  agreement: AgreementState
  role: PartyRole
  signature?: SignatureRecord
}) {
  const valid = signatureMatchesFinalAgreement(agreement, signature)
  return (
    <section className={valid ? 'esign-signature-block signed' : 'esign-signature-block'}>
      <p className="document-kicker">{role}</p>
      <h3>{agreement[role].name}</h3>
      {valid && signature ? (
        <>
          <strong>Digitally signed ✓</strong>
          <span>{formatDateTime(signature.signedAt)}</span>
          <span>Document ID: {agreement.documentId}</span>
          <small>{signature.signatureReference} · Demo eSign</small>
        </>
      ) : <strong>Awaiting signature</strong>}
    </section>
  )
}

export function FinalAgreementPreview({ agreement, onClose }: FinalAgreementPreviewProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const inventory = finalAgreementInventory(agreement)
  const stampPayment = stampDutyPaymentFor(agreement)
  const notarizationStatus = resolveNotarizationStatus(agreement)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus()
    return () => previousFocus?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div ref={dialogRef} className="esign-preview-layer" role="dialog" aria-modal="true" aria-labelledby="final-agreement-title" onKeyDown={handleKeyDown}>
      <div className="esign-preview-shell">
        <header className="esign-preview-toolbar">
          <div><strong>Final agreement</strong><small>Read-only · Version {finalAgreementVersion(agreement)}</small></div>
          <Button variant="ghost" onClick={onClose} aria-label="Close final agreement">Close</Button>
        </header>
        <article className="agreement-paper esign-agreement-paper">
          <div className="esign-document-badges"><Badge tone="success">Finalized</Badge><Badge tone="accent">Demo eSign</Badge></div>
          <p className="document-kicker">Final agreement</p>
          <h2 id="final-agreement-title">Residential Rent Agreement</h2>
          <p className="document-intro">Version {finalAgreementVersion(agreement)} · Finalized: {formatDate(agreement.finalizedAt)}</p>
          <div className="esign-document-parties">
            <span><small>Landlord</small><strong>{agreement.landlord.name}</strong></span>
            <span><small>Tenant</small><strong>{agreement.tenant.name}</strong></span>
          </div>
          <div className="document-clauses">
            {agreement.clauses.map((clause, index) => (
              <section key={clause.id}><h3>{index + 1}. {clause.title}</h3><p>{clause.text}</p></section>
            ))}
          </div>
          {inventory.length ? (
            <section className="inventory-schedule">
              <h3>Schedule A — Furnishings, fixtures and inventory</h3>
              <div className="inventory-table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Condition</th><th>Notes</th></tr></thead><tbody>
                {inventory.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.quantity}</td><td>{item.condition}</td><td>{item.notes || '—'}</td></tr>)}
              </tbody></table></div>
            </section>
          ) : null}
          <section className="esign-execution-evidence">
            <h2>Execution record</h2>
            <div className="esign-evidence-grid">
              <div><small>Demo stamp duty</small><strong>{agreement.requirements.stampDutyAmount === 0 ? 'Not required' : agreement.stampCompleted ? `₹${agreement.requirements.stampDutyAmount.toLocaleString('en-IN')} completed ✓` : 'Incomplete'}</strong>{(['landlord', 'tenant'] as const).map((role) => stampPayment[role].paymentReference ? <span key={role}>{agreement[role].name}: {stampPayment[role].paymentReference}</span> : null)}</div>
              <div><small>Notarial attestation</small><strong>{notarizationStatus === 'completed' ? 'Completed ✓' : 'Not selected'}</strong>{notarizationStatus === 'completed' ? <span>{agreement.notaryDisplayName} · {agreement.notaryRegistrationId}</span> : null}</div>
              <div><small>Saral Setu document ID</small><strong>{agreement.documentId ?? 'Preparing…'}</strong><span>Version {finalAgreementVersion(agreement)}</span></div>
            </div>
          </section>
          <section className="esign-signatures-section">
            <h2>Signatures</h2>
            <div className="esign-signature-grid">
              <SignatureBlock agreement={agreement} role="landlord" signature={agreement.landlordSignature} />
              <SignatureBlock agreement={agreement} role="tenant" signature={agreement.tenantSignature} />
            </div>
          </section>
          <p className="document-disclaimer">Saral Setu hackathon prototype. The signature records shown here simulate an eSign ceremony and are not government-issued certificates.</p>
        </article>
      </div>
    </div>
  )
}
