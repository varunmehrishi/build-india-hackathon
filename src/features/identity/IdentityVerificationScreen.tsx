import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { areBothPartiesVerified, isPartyVerifiedForVersion } from '../../domain/identityVerification'
import type { AgreementState, PartyRole } from '../../domain/types'
import { AadhaarOtpDialog, type AadhaarVerificationResult } from '../auth/AadhaarOtpDialog'
import { DEMO_IDENTITIES } from '../../domain/auth'

interface IdentityVerificationScreenProps {
  agreement: AgreementState
  viewingRole: PartyRole
  onVerify: (role: PartyRole, result: AadhaarVerificationResult) => boolean
  lockDemoIdentity?: boolean
}

function roleLabel(role: PartyRole): string {
  return role === 'landlord' ? 'Landlord' : 'Tenant'
}

export function IdentityVerificationScreen({
  agreement,
  viewingRole,
  onVerify,
  lockDemoIdentity = false,
}: IdentityVerificationScreenProps) {
  const [verifyingRole, setVerifyingRole] = useState<PartyRole | null>(null)
  const bothVerified = areBothPartiesVerified(agreement)

  return (
    <div className="identity-verification-content">
      <Card className="identity-verification-card">
        <header className="identity-verification-heading">
          <div>
            <p className="eyebrow">Identity Verification</p>
            <h1>Verify the people signing</h1>
            <p className="lede">Confirm both identities against the final agreement before execution begins.</p>
          </div>
          <div className="review-role-control identity-role-control">
            <small>Viewing as</small>
            <strong>{agreement[viewingRole].name} — {roleLabel(viewingRole)}</strong>
          </div>
        </header>

        <div className="identity-version-banner">
          <span><small>Final agreement</small><strong>Version {agreement.agreementVersion}</strong></span>
          <Badge tone={bothVerified ? 'success' : 'accent'}>{bothVerified ? 'Ready for execution' : '2 identities required'}</Badge>
        </div>

        <div className="identity-party-grid">
          {(['landlord', 'tenant'] as const).map((role) => {
            const party = agreement[role]
            const verified = isPartyVerifiedForVersion(party, agreement.agreementVersion)
            const isViewing = viewingRole === role
            return (
              <section key={role} className={isViewing ? 'identity-party-card active' : 'identity-party-card'} aria-label={`${roleLabel(role)} identity`}>
                <div className="identity-party-heading">
                  <div className="identity-party-avatar" aria-hidden="true">{party.name.trim().charAt(0) || role.charAt(0).toUpperCase()}</div>
                  <div><small>{roleLabel(role)}</small><h2>{party.name}</h2></div>
                  <Badge tone={verified ? 'success' : 'neutral'}>{verified ? '✓ Verified' : 'Not verified'}</Badge>
                </div>
                {verified ? (
                  <div className="identity-verified-detail">
                    <strong>✓ Identity verified</strong>
                    <span>Agreement Version {party.identityVerifiedVersion}{party.identityVerifiedAadhaarLast4 ? ` · Aadhaar ending ${party.identityVerifiedAadhaarLast4}` : ''}</span>
                  </div>
                ) : isViewing ? (
                  <Button onClick={() => setVerifyingRole(role)}>Verify Identity</Button>
                ) : (
                  <p className="party-message">Complete this identity check in that party’s demo view.</p>
                )}
              </section>
            )
          })}
        </div>

        <section className={bothVerified ? 'identity-ready-panel complete' : 'identity-ready-panel'} aria-live="polite">
          <span aria-hidden="true">{bothVerified ? '✓' : '○'}</span>
          <div>
            <h2>{bothVerified ? 'Both parties are ready for execution.' : 'Verify both parties to continue'}</h2>
            <p>{bothVerified ? 'The landlord and tenant are verified for this final agreement version.' : 'Switch the viewing role to complete each person’s identity check.'}</p>
          </div>
        </section>
      </Card>

      {verifyingRole ? (
        <AadhaarOtpDialog
          key={verifyingRole}
          idPrefix={`identity-${verifyingRole}`}
          layerClassName="modal-layer identity-verification-layer"
          eyebrow={`${roleLabel(verifyingRole)} · Agreement Version ${agreement.agreementVersion}`}
          title={`Verify ${agreement[verifyingRole].name}`}
          description={`You are verifying the ${roleLabel(verifyingRole).toLowerCase()} who will execute this finalized agreement.`}
          submitLabel="Verify identity"
          disclaimer="Static hackathon simulation only. Any 12-digit number works, processing stays in this browser, and this is not connected to UIDAI or a government service."
          fixedIdentity={lockDemoIdentity ? DEMO_IDENTITIES.find((identity) => identity.roleLabel.toLowerCase() === verifyingRole) : undefined}
          onCancel={() => setVerifyingRole(null)}
          onVerified={(result) => {
            if (onVerify(verifyingRole, result)) setVerifyingRole(null)
          }}
        />
      ) : null}
    </div>
  )
}
