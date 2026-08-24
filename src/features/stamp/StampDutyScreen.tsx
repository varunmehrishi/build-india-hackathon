import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { stampDutyPaymentFor } from '../../domain/stampDuty'
import type { AgreementState, PartyRole, StampContributionStatus } from '../../domain/types'

interface StampDutyScreenProps {
  agreement: AgreementState
  documentName: string
  activeRole?: PartyRole
  onConfigure: (landlordPercentage: number) => void
  onPay: () => Promise<void>
}

const roleLabels: Record<PartyRole, string> = { landlord: 'Landlord', tenant: 'Tenant' }

function statusLabel(status: StampContributionStatus): string {
  if (status === 'not-required') return 'Not required'
  if (status === 'paid') return 'Paid'
  return 'Payment due'
}

function statusTone(status: StampContributionStatus): 'neutral' | 'success' | 'warning' {
  if (status === 'paid') return 'success'
  if (status === 'pending') return 'warning'
  return 'neutral'
}

function formatPaidAt(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function StampDutyScreen({
  agreement,
  documentName,
  activeRole,
  onConfigure,
  onPay,
}: StampDutyScreenProps) {
  const payment = stampDutyPaymentFor(agreement)
  const [customPercentage, setCustomPercentage] = useState(String(payment.landlord.percentage))
  const [customError, setCustomError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const ownContribution = activeRole ? payment[activeRole] : undefined
  const hasReceipts = payment.landlord.status === 'paid' || payment.tenant.status === 'paid'

  function configure(percentage: number) {
    setCustomPercentage(String(percentage))
    setCustomError('')
    onConfigure(percentage)
  }

  function applyCustom() {
    const percentage = Number(customPercentage)
    if (!/^\d+$/.test(customPercentage.trim()) || !Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      setCustomError('Enter a whole number from 0 to 100.')
      return
    }
    configure(percentage)
  }

  async function pay() {
    if (!activeRole || !ownContribution || ownContribution.status !== 'pending' || processing) return
    setProcessing(true)
    setPaymentError('')
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 450))
      await onPay()
    } catch {
      setPaymentError('Payment could not be completed locally. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="stamp-content">
      <Card className="stamp-card">
        <div className="stamp-heading">
          <div>
            <p className="eyebrow">Execution step</p>
            <h1>Stamp duty</h1>
            <p className="lede">Choose how the parties will split this illustrative payment, then complete each required contribution.</p>
          </div>
          <Badge tone={agreement.stampCompleted ? 'success' : 'warning'}>
            {agreement.stampCompleted ? 'Completed' : 'Payment pending'}
          </Badge>
        </div>

        <div className="stamp-overview">
          <span><small>Document</small><strong>{documentName}</strong></span>
          <span><small>Property state</small><strong>{agreement.property.state}</strong></span>
          <span><small>Total amount</small><strong>₹{agreement.requirements.stampDutyAmount.toLocaleString('en-IN')}</strong></span>
        </div>

        <p className="stamp-disclaimer">
          Demo calculation only. This is a simulated payment and not an authoritative stamp-duty assessment or government receipt.
        </p>

        <section className="stamp-section" aria-labelledby="payment-split-heading">
          <div className="stamp-section-heading">
            <div><p className="eyebrow">Payment setup</p><h2 id="payment-split-heading">Who will pay?</h2></div>
            {payment.locked ? <Badge tone="neutral">Split locked</Badge> : null}
          </div>
          <div className="split-presets" aria-label="Payment split presets">
            <Button variant={payment.landlord.percentage === 100 ? 'secondary' : 'ghost'} onClick={() => configure(100)} disabled={payment.locked}>Landlord 100%</Button>
            <Button variant={payment.landlord.percentage === 0 ? 'secondary' : 'ghost'} onClick={() => configure(0)} disabled={payment.locked}>Tenant 100%</Button>
            <Button variant={payment.landlord.percentage === 50 ? 'secondary' : 'ghost'} onClick={() => configure(50)} disabled={payment.locked}>Split 50/50</Button>
          </div>
          <div className="custom-split">
            <Input
              label="Custom landlord percentage"
              type="number"
              min="0"
              max="100"
              step="1"
              value={customPercentage}
              onChange={(event) => setCustomPercentage(event.target.value)}
              error={customError}
              disabled={payment.locked}
            />
            <Button variant="secondary" onClick={applyCustom} disabled={payment.locked}>Apply custom split</Button>
            <span className="custom-complement">Tenant pays {100 - (Number(customPercentage) || 0)}%</span>
          </div>
          {payment.configuredBy ? <p className="muted split-note">Configured by the {roleLabels[payment.configuredBy].toLowerCase()}.</p> : null}
        </section>

        <section className="stamp-section" aria-labelledby="contributions-heading">
          <div className="stamp-section-heading"><div><p className="eyebrow">Contributions</p><h2 id="contributions-heading">Party payments</h2></div></div>
          <div className="contribution-grid">
            {(['landlord', 'tenant'] as const).map((role) => {
              const item = payment[role]
              const isCurrentParty = role === activeRole
              return (
                <article className={isCurrentParty ? 'contribution-card is-current-party' : 'contribution-card'} key={role}>
                  <div className="contribution-heading">
                    <div><small>{roleLabels[role]}</small><strong>{agreement[role].name}</strong></div>
                    <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                  </div>
                  <div className="contribution-amount"><strong>₹{item.amount.toLocaleString('en-IN')}</strong><span>{item.percentage}% of total</span></div>
                  {isCurrentParty && item.status === 'pending' ? (
                    <Button onClick={() => void pay()} disabled={processing}>{processing ? 'Processing…' : `Pay ₹${item.amount.toLocaleString('en-IN')}`}</Button>
                  ) : !isCurrentParty && item.status === 'pending' ? (
                    <p className="party-message">Awaiting the {roleLabels[role].toLowerCase()} on their device.</p>
                  ) : item.status === 'not-required' ? (
                    <p className="party-message">No payment is required from this party.</p>
                  ) : (
                    <p className="party-message success-message">Contribution received.</p>
                  )}
                </article>
              )
            })}
          </div>
          {paymentError ? <p className="field-error" role="alert">{paymentError}</p> : null}
          {!activeRole ? <p className="field-error">Assign this browser a landlord or tenant role before paying.</p> : null}
        </section>

        {hasReceipts ? (
          <section className="stamp-section" aria-labelledby="receipts-heading">
            <div className="stamp-section-heading"><div><p className="eyebrow">Payment record</p><h2 id="receipts-heading">Receipts</h2></div></div>
            <div className="receipt-list">
              {(['landlord', 'tenant'] as const).map((role) => {
                const item = payment[role]
                if (item.status !== 'paid' || !item.paymentReference || !item.paidAt) return null
                return (
                  <article className="receipt" key={role}>
                    <div><small>Party</small><strong>{agreement[role].name} · {roleLabels[role]}</strong></div>
                    <div><small>Amount</small><strong>₹{item.amount.toLocaleString('en-IN')}</strong></div>
                    <div><small>Reference</small><strong>{item.paymentReference}</strong></div>
                    <div><small>Paid</small><strong>{formatPaidAt(item.paidAt)}</strong></div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}
      </Card>
    </div>
  )
}
