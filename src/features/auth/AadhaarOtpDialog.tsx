import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import {
  DEMO_IDENTITIES,
  DEMO_OTP,
  demoIdentityForAadhaar,
  encryptAadhaar,
  participantIdForAadhaar,
  type EncryptedAadhaarRecord,
} from '../../domain/auth'

export interface AadhaarVerificationResult {
  participantId: string
  encryptedAadhaar: EncryptedAadhaarRecord
  demoDisplayName?: string
}

interface AadhaarOtpDialogProps {
  title: string
  eyebrow: string
  description: string
  submitLabel: string
  disclaimer: string
  onVerified: (result: AadhaarVerificationResult) => void
  onCancel?: () => void
  layerClassName?: string
  idPrefix?: string
}

function formatAadhaar(value: string): string {
  return value.replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function AadhaarOtpDialog({
  title,
  eyebrow,
  description,
  submitLabel,
  disclaimer,
  onVerified,
  onCancel,
  layerClassName = 'auth-layer',
  idPrefix = 'demo',
}: AadhaarOtpDialogProps) {
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const aadhaarId = `${idPrefix}-aadhaar`
  const otpId = `${idPrefix}-otp`
  const titleId = `${idPrefix}-title`

  useEffect(() => {
    document.getElementById(aadhaarId)?.focus()
  }, [aadhaarId])

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ))
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

  function sendOtp(event: React.FormEvent) {
    event.preventDefault()
    if (identifier.replace(/\D/g, '').length !== 12) {
      setError('Enter a complete 12-digit Aadhaar number.')
      return
    }
    setError('')
    setOtpSent(true)
    window.setTimeout(() => document.getElementById(otpId)?.focus(), 0)
  }

  async function completeVerification(candidateOtp: string) {
    if (candidateOtp !== DEMO_OTP) {
      setError('That OTP does not match the code in the demo Messages notification.')
      return
    }
    setError('')
    setIsVerifying(true)
    try {
      const aadhaarDigits = identifier.replace(/\D/g, '')
      const [encryptedAadhaar, participantId] = await Promise.all([
        encryptAadhaar(aadhaarDigits),
        participantIdForAadhaar(aadhaarDigits),
      ])
      onVerified({
        participantId,
        encryptedAadhaar,
        demoDisplayName: demoIdentityForAadhaar(aadhaarDigits)?.displayName,
      })
    } catch {
      setError('Your browser could not complete the local demo verification. Please try again.')
      setIsVerifying(false)
    }
  }

  return (
    <div className={layerClassName}>
      {otpSent ? (
        <aside className="message-notification" aria-live="polite" aria-label="Demo message">
          <div className="message-icon" aria-hidden="true">M</div>
          <div className="message-copy"><strong>Messages · now</strong><span>Your Saral Setu demo OTP is {DEMO_OTP}</span></div>
          <button type="button" className="message-prefill" onClick={() => { setOtp(DEMO_OTP); void completeVerification(DEMO_OTP) }}>Prefill from Messages</button>
        </aside>
      ) : null}

      <div ref={dialogRef} className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={trapFocus}>
        <div className="identity-mark" aria-hidden="true">भारत</div>
        <div><p className="eyebrow">{eyebrow}</p><h1 id={titleId}>{title}</h1><p className="muted">{description}</p></div>

        {!otpSent ? (
          <form onSubmit={sendOtp} className="auth-form" noValidate>
            <Input id={aadhaarId} label="Aadhaar number" value={identifier} onChange={(event) => setIdentifier(formatAadhaar(event.target.value))} inputMode="numeric" autoComplete="off" placeholder="XXXX XXXX XXXX" hint="Any 12-digit number is accepted for this local simulation." error={error || undefined} />
            <div className="demo-identity-options" aria-label="Demo Aadhaar profiles">
              {DEMO_IDENTITIES.map((identity) => (
                <button type="button" key={identity.aadhaar} aria-label={`Prefill ${identity.displayName} Aadhaar ${formatAadhaar(identity.aadhaar)}`} onClick={() => { setIdentifier(formatAadhaar(identity.aadhaar)); setError('') }}>
                  <span><strong>{identity.displayName}</strong><small>{identity.roleLabel} demo</small></span><span>{formatAadhaar(identity.aadhaar)}</span>
                </button>
              ))}
            </div>
            <div className="action-stack"><Button type="submit">Send OTP</Button>{onCancel ? <Button variant="ghost" onClick={onCancel}>Cancel</Button> : null}</div>
          </form>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void completeVerification(otp) }} className="auth-form" noValidate>
            <Input id={otpId} label="6-digit OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter the message code" error={error || undefined} />
            <div className="action-stack">
              <Button type="submit" disabled={isVerifying}>{isVerifying ? 'Verifying locally…' : submitLabel}</Button>
              <Button variant="ghost" onClick={() => { setOtpSent(false); setOtp(''); setError('') }}>Use another number</Button>
              {onCancel ? <Button variant="ghost" onClick={onCancel}>Cancel</Button> : null}
            </div>
          </form>
        )}
        <p className="auth-disclaimer">{disclaimer}</p>
      </div>
    </div>
  )
}
