import { buildAuditTrail } from '../../domain/completion'
import type { AgreementState } from '../../domain/types'

interface AuditTrailProps {
  agreement: AgreementState
}

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(timestamp))
}

export function AuditTrail({ agreement }: AuditTrailProps) {
  const events = buildAuditTrail(agreement)
  return events.length ? (
    <ol className="completion-audit-list" aria-label="Agreement audit events">
      {events.map((event) => (
        <li key={event.id}>
          <time dateTime={event.timestamp}>{formatDateTime(event.timestamp)}</time>
          <span><strong>{event.message}</strong>{event.actor ? <small>{agreement[event.actor].name}</small> : null}</span>
        </li>
      ))}
    </ol>
  ) : <p className="muted">No timestamped workflow events are available for this agreement.</p>
}
