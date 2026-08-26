import { DEMO_IDENTITIES, type DemoAuthSession } from '../../domain/auth'
import { AadhaarOtpDialog, type AadhaarVerificationResult } from './AadhaarOtpDialog'

interface AuthGateProps {
  onAuthenticated: (session: DemoAuthSession) => void
  suggestedDisplayName?: string
  fixedRole?: 'landlord' | 'tenant'
}

export function AuthGate({ onAuthenticated, suggestedDisplayName = 'Meera Sharma', fixedRole }: AuthGateProps) {
  const fixedIdentity = fixedRole
    ? DEMO_IDENTITIES.find((identity) => identity.roleLabel.toLowerCase() === fixedRole)
    : undefined
  function completeLogin(result: AadhaarVerificationResult) {
    onAuthenticated({
      version: 2,
      authenticated: true,
      participantId: result.participantId,
      displayName: result.demoDisplayName ?? suggestedDisplayName,
      roleBindings: [],
      encryptedAadhaar: result.encryptedAadhaar,
    })
  }

  return (
    <AadhaarOtpDialog
      title="Simulated Aadhaar OTP"
      eyebrow="Secure demo entry"
      description="Sign in to continue your guided rent-agreement journey."
      submitLabel="Verify & continue"
      disclaimer="Static hackathon simulation only. The number creates a stable demo identity and is encrypted in this browser. This experience is not connected to UIDAI or any government service."
      fixedIdentity={fixedIdentity}
      onVerified={completeLogin}
    />
  )
}
