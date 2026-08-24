import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import {
  DEMO_OTP,
  encryptAadhaar,
  type DemoAuthSession,
} from '../../domain/auth'

interface AuthGateProps {
  onAuthenticated: (session: DemoAuthSession) => void
  suggestedDisplayName?: string
}

function formatAadhaar(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 12)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function AuthGate({ onAuthenticated, suggestedDisplayName = 'Meera Sharma' }: AuthGateProps) {
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.getElementById('demo-aadhaar')?.focus()
  }, [])

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
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
    const digits = identifier.replace(/\D/g, '')
    if (digits.length !== 12) {
      setError('Enter a complete 12-digit Aadhaar number.')
      return
    }
    setError('')
    setOtpSent(true)
    window.setTimeout(() => document.getElementById('demo-otp')?.focus(), 0)
  }

  async function completeLogin(candidateOtp: string) {
    if (candidateOtp !== DEMO_OTP) {
      setError('That OTP does not match the code in the demo Messages notification.')
      return
    }
    setError('')
    setIsVerifying(true)
    try {
      const aadhaarDigits = identifier.replace(/\D/g, '')
      const encryptedAadhaar = await encryptAadhaar(aadhaarDigits)
      setIdentifier('')
      setOtp('')
      onAuthenticated({
        version: 2,
        authenticated: true,
        participantId: crypto.randomUUID(),
        displayName: suggestedDisplayName,
        roleBindings: [],
        encryptedAadhaar,
      })
    } catch {
      setError('Your browser could not create the local encrypted demo session. Please try again.')
      setIsVerifying(false)
    }
  }

  function verifyOtp(event: React.FormEvent) {
    event.preventDefault()
    void completeLogin(otp)
  }

  function prefillAndVerify() {
    setOtp(DEMO_OTP)
    void completeLogin(DEMO_OTP)
  }

  return (
    <div className="auth-layer">
      {otpSent ? (
        <aside className="message-notification" aria-live="polite" aria-label="Demo message">
          <div className="message-icon" aria-hidden="true">M</div>
          <div className="message-copy">
            <strong>Messages · now</strong>
            <span>Your Saral Setu demo OTP is {DEMO_OTP}</span>
          </div>
          <button type="button" className="message-prefill" onClick={prefillAndVerify}>
            Prefill from Messages
          </button>
        </aside>
      ) : null}

      <div
        ref={dialogRef}
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onKeyDown={trapFocus}
      >
        <div className="identity-mark" aria-hidden="true">भारत</div>
        <div>
          <p className="eyebrow">Secure demo entry</p>
          <h1 id="auth-title">Simulated Aadhaar OTP</h1>
          <p className="muted">
            Sign in to continue your guided rent-agreement journey.
          </p>
        </div>

        {!otpSent ? (
          <form onSubmit={sendOtp} className="auth-form" noValidate>
            <Input
              id="demo-aadhaar"
              label="Aadhaar number"
              value={identifier}
              onChange={(event) => setIdentifier(formatAadhaar(event.target.value))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="XXXX XXXX XXXX"
              hint="Any 12-digit number is accepted for this local simulation."
              error={error || undefined}
            />
            <Button type="submit">Send OTP</Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="auth-form" noValidate>
            <Input
              id="demo-otp"
              label="6-digit OTP"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter the message code"
              error={error || undefined}
            />
            <div className="action-stack">
              <Button type="submit" disabled={isVerifying}>
                {isVerifying ? 'Verifying locally…' : 'Verify & continue'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOtpSent(false)
                  setOtp('')
                  setError('')
                }}
              >
                Use another number
              </Button>
            </div>
          </form>
        )}

        <p className="auth-disclaimer">
          Static hackathon simulation only. The number is encrypted in this browser and is never
          included in shared agreement links. This experience is not connected to UIDAI or any
          government service.
        </p>
      </div>
    </div>
  )
}
