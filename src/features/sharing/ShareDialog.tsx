import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { createSnapshotUrl, type WorkflowSnapshotEnvelope } from '../../domain/snapshot'
import type { AgreementState, PartyRole } from '../../domain/types'

interface ShareDialogProps {
  agreement: AgreementState
  furthestStepIndex: number
  activeRole: PartyRole
  onClose: () => void
}

export function ShareDialog({ agreement, furthestStepIndex, activeRole, onClose }: ShareDialogProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'fallback'>('idle')
  const linkRef = useRef<HTMLTextAreaElement>(null)
  const invitedRole: PartyRole = activeRole === 'landlord' ? 'tenant' : 'landlord'
  const invite = useMemo(() => {
    try {
      const snapshot: WorkflowSnapshotEnvelope = {
        codecVersion: 1,
        agreement,
        furthestStepIndex,
        invitedRole,
      }
      return { url: createSnapshotUrl(snapshot), error: '' }
    } catch (error) {
      return {
        url: '',
        error: error instanceof Error ? error.message : 'This agreement could not be shared.',
      }
    }
  }, [agreement, furthestStepIndex, invitedRole])

  useEffect(() => document.getElementById('close-share-dialog')?.focus(), [])

  async function copyInvite() {
    if (!invite.url) return
    try {
      await navigator.clipboard.writeText(invite.url)
      setCopyState('copied')
    } catch {
      setCopyState('fallback')
      window.setTimeout(() => { linkRef.current?.focus(); linkRef.current?.select() }, 0)
    }
  }

  return (
    <div className="modal-layer" role="presentation">
      <section
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}
      >
        <div>
          <p className="eyebrow">Point-in-time collaboration</p>
          <h2 id="share-title">Invite the {invitedRole}</h2>
          <p className="muted">
            This link opens revision {agreement.snapshotRevision} and assigns the recipient as the {invitedRole}.
          </p>
        </div>
        {invite.error ? (
          <div className="error-summary" role="alert">{invite.error}</div>
        ) : (
          <textarea ref={linkRef} className="share-link" value={invite.url} readOnly aria-label="Invite link" rows={4} />
        )}
        <div className="action-stack">
          <Button disabled={!invite.url} onClick={() => void copyInvite()}>{copyState === 'copied' ? 'Copied' : 'Copy invite link'}</Button>
          <Button id="close-share-dialog" variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {copyState === 'fallback' ? <p className="field-hint" role="status">Clipboard access was blocked. The link is selected for manual copying.</p> : null}
      </section>
    </div>
  )
}
