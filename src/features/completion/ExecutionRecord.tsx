import { Badge } from '../../components/ui/Badge'
import { deriveCompletionSummary } from '../../domain/completion'
import { resolveNotarizationStatus } from '../../domain/notarization'
import type { AgreementState } from '../../domain/types'
import { AuditTrail } from './AuditTrail'

interface ExecutionRecordProps {
  agreement: AgreementState
  integrity: boolean | null
}

function formatDateTime(timestamp?: string): string {
  if (!timestamp) return 'Not recorded'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(timestamp))
}

export function ExecutionRecord({ agreement, integrity }: ExecutionRecordProps) {
  const summary = deriveCompletionSummary(agreement)
  const notary = resolveNotarizationStatus(agreement)
  return (
    <article className="execution-record">
      <header>
        <p className="document-kicker">Saral Setu execution record</p>
        <h3>Residential Rent Agreement</h3>
        <Badge tone="accent">Hackathon demo</Badge>
      </header>
      <dl className="execution-record-meta">
        <div><dt>Document ID</dt><dd>{summary.documentId}</dd></div>
        <div><dt>Final version</dt><dd>{summary.finalizedVersion}</dd></div>
        <div><dt>Completed</dt><dd>{formatDateTime(summary.completedAt)}</dd></div>
      </dl>
      <section><h3>Parties</h3><div className="execution-party-grid">
        {(['landlord', 'tenant'] as const).map((role) => <div key={role}><small>{role}</small><strong>{agreement[role].name}</strong><span>Identity verified ✓</span><span>Signed Version {role === 'landlord' ? agreement.landlordSignature?.signedVersion : agreement.tenantSignature?.signedVersion} ✓</span></div>)}
      </div></section>
      <section><h3>Execution</h3><ul className="execution-record-checks">
        <li><span>Agreement finalized</span><strong>✓</strong></li>
        <li><span>Stamp duty completed</span><strong>✓</strong></li>
        <li><span>Notarial attestation</span><strong>{notary === 'completed' ? 'Completed ✓' : 'Not selected'}</strong></li>
        <li><span>Both parties signed</span><strong>✓</strong></li>
        <li><span>Document integrity</span><strong>{integrity === true ? 'Verified ✓' : integrity === false ? 'Changed' : 'Checking…'}</strong></li>
      </ul></section>
      <details className="execution-technical"><summary>Technical details</summary><div><small>SHA-256</small><code>{agreement.finalDocumentHash}</code></div></details>
      <section><h3>Audit trail</h3><AuditTrail agreement={agreement} /></section>
      <p className="document-disclaimer">This record summarizes the Saral Setu hackathon demo. It is not a government-issued certificate.</p>
    </article>
  )
}
