import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { demoEmailForParty } from '../../domain/completion'
import type { AgreementState, PartyRole } from '../../domain/types'
import { CompletionDialog } from './CompletionDialog'

interface EmailAgreementDialogProps {
  agreement: AgreementState
  onClose: () => void
}

export function EmailAgreementDialog({ agreement, onClose }: EmailAgreementDialogProps) {
  const [selected, setSelected] = useState<Record<PartyRole, boolean>>({ landlord: true, tenant: true })
  const [additionalEmail, setAdditionalEmail] = useState('')
  const [sent, setSent] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected.landlord && !selected.tenant && !additionalEmail.trim()) return
    setSent(true)
  }

  return (
    <CompletionDialog title="Email signed agreement" eyebrow="Demo delivery" onClose={onClose}>
      {sent ? (
        <div className="completion-email-success" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          <h3>Demo email prepared</h3>
          <p>The signed agreement was prepared for the selected recipients. No real email was sent from this static demo.</p>
          <ul>
            {(['tenant', 'landlord'] as const).filter((role) => selected[role]).map((role) => <li key={role}>{agreement[role].name}</li>)}
            {additionalEmail.trim() ? <li>{additionalEmail.trim()}</li> : null}
          </ul>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form className="completion-email-form" onSubmit={submit}>
          <p>Select who should receive the signed agreement in this simulated email flow.</p>
          {(['tenant', 'landlord'] as const).map((role) => (
            <label className="completion-recipient" key={role}>
              <input
                type="checkbox"
                checked={selected[role]}
                onChange={(event) => setSelected((current) => ({ ...current, [role]: event.target.checked }))}
              />
              <span><strong>{agreement[role].name}</strong><small>{demoEmailForParty(agreement[role].name, role)}</small></span>
            </label>
          ))}
          <label className="field">
            <span className="field-label">Additional email</span>
            <input className="input" type="email" value={additionalEmail} onChange={(event) => setAdditionalEmail(event.target.value)} placeholder="name@example.com" />
          </label>
          <p className="completion-demo-note">Demo only — Saral Setu will not contact these addresses.</p>
          <Button type="submit" disabled={!selected.landlord && !selected.tenant && !additionalEmail.trim()}>Send Agreement</Button>
        </form>
      )}
    </CompletionDialog>
  )
}
