import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { classifyIntent } from '../../domain/intake'

interface IntentScreenProps {
  initialValue: string
  onContinue: (intentText: string) => void
}

const comingSoonWorkflows = ['Affidavit', 'Power of Attorney', 'Service Agreement']

export function IntentScreen({ initialValue, onContinue }: IntentScreenProps) {
  const [intent, setIntent] = useState(initialValue)
  const [error, setError] = useState('')

  function submitIntent(event: React.FormEvent) {
    event.preventDefault()
    if (!intent.trim()) {
      setError('Describe what you need, or choose Rent Agreement above.')
      return
    }
    if (classifyIntent(intent) === 'unsupported') {
      setError('This demo currently supports residential rent agreements. Try mentioning rent or lease.')
      return
    }
    setError('')
    onContinue(intent.trim())
  }

  return (
    <main className="focused-content" id="main-content">
      <section className="intent-hero">
        <p className="eyebrow">One clear path, end to end</p>
        <h1>What do you need to get done?</h1>
        <p className="lede">
          Tell us the outcome. We’ll turn it into a simple, guided process for this demo.
        </p>
      </section>

      <section aria-labelledby="workflow-heading">
        <div className="section-heading inline-heading">
          <div>
            <p className="eyebrow">Choose a workflow</p>
            <h2 id="workflow-heading">Popular services</h2>
          </div>
          <span className="muted">1 available</span>
        </div>
        <div className="workflow-card-grid">
          <button type="button" className="workflow-card available" aria-label="Rent Agreement" onClick={() => onContinue('Rent agreement')}>
            <span className="workflow-icon" aria-hidden="true">⌂</span>
            <span className="workflow-card-copy">
              <strong>Rent Agreement</strong>
              <small>Residential tenancy, guided from details to signing</small>
            </span>
            <Badge tone="success">Available</Badge>
          </button>
          {comingSoonWorkflows.map((workflow) => (
            <div className="workflow-card unavailable" key={workflow} aria-disabled="true">
              <span className="workflow-icon" aria-hidden="true">◇</span>
              <span className="workflow-card-copy">
                <strong>{workflow}</strong>
                <small>We’re preparing this guided workflow</small>
              </span>
              <Badge>Coming soon</Badge>
            </div>
          ))}
        </div>
      </section>

      <Card className="intent-entry">
        <form onSubmit={submitIntent} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="intent-input">Describe what you need</label>
            <textarea
              id="intent-input"
              className={['input', 'intent-input', error ? 'input-error' : ''].filter(Boolean).join(' ')}
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              placeholder="I need an 11-month rent agreement for a flat in Bengaluru."
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'intent-error' : undefined}
            />
            {error ? (
              <span className="field-error" id="intent-error" role="alert">{error}</span>
            ) : null}
          </div>
          <Button type="submit">Find my workflow</Button>
        </form>
      </Card>
    </main>
  )
}
