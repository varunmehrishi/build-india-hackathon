import { useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import {
  demoIntakeDraft,
  indianStatesAndTerritories,
  propertyTypeOptions,
  validateIntake,
} from '../../domain/intake'
import type { IntakeDraft, IntakeErrors, IntakeField } from '../../domain/types'

interface DetailsScreenProps {
  draft: IntakeDraft
  onDraftChange: (draft: IntakeDraft) => void
  onBack: () => void
  onSubmit: (draft: IntakeDraft) => void
}

const fieldOrder: IntakeField[] = [
  'initiator', 'state', 'city', 'address', 'propertyType', 'monthlyRent',
  'securityDeposit', 'durationMonths', 'startDate', 'landlordName', 'tenantName',
  'documentName',
]

export function DetailsScreen({ draft, onDraftChange, onBack, onSubmit }: DetailsScreenProps) {
  const [errors, setErrors] = useState<IntakeErrors>({})
  const errorSummaryRef = useRef<HTMLDivElement>(null)

  function update<K extends IntakeField>(field: K, value: IntakeDraft[K]) {
    onDraftChange({ ...draft, [field]: value })
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const nextErrors = validateIntake(draft)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      window.setTimeout(() => {
        errorSummaryRef.current?.focus()
        const firstField = fieldOrder.find((field) => nextErrors[field])
        if (firstField) document.getElementById(firstField)?.focus()
      }, 0)
      return
    }
    onSubmit(draft)
  }

  return (
    <main className="focused-content details-content" id="main-content">
      <div className="compact-progress" aria-label="Workflow progress">
        <span>Step 2 of 11</span>
        <div className="progress-track"><span style={{ width: '18%' }} /></div>
        <strong>Tenancy details</strong>
      </div>

      <section className="details-heading">
        <div>
          <p className="eyebrow">A few essentials</p>
          <h1>Tell us about the tenancy</h1>
          <p className="lede">Everything stays editable. Use the demo details for the fastest path.</p>
        </div>
        <Button variant="secondary" onClick={() => { onDraftChange({ ...demoIntakeDraft }); setErrors({}) }}>
          Use demo details
        </Button>
      </section>

      {Object.keys(errors).length > 0 ? (
        <div className="error-summary" role="alert" tabIndex={-1} ref={errorSummaryRef}>
          <strong>Please check the highlighted details.</strong>
          <span>{Object.keys(errors).length} field{Object.keys(errors).length === 1 ? '' : 's'} need attention.</span>
        </div>
      ) : null}

      <form className="details-form" onSubmit={submit} noValidate>
        <Card className="form-section">
          <div className="form-section-heading"><span>1</span><div><h2>About you</h2><p>Who is starting this agreement?</p></div></div>
          <fieldset className="role-fieldset" id="initiator" tabIndex={-1} aria-describedby={errors.initiator ? 'initiator-error' : undefined}>
            <legend className="field-label">I am the</legend>
            <div className="role-options">
              {(['landlord', 'tenant'] as const).map((role) => (
                <label className={draft.initiator === role ? 'role-option selected' : 'role-option'} key={role}>
                  <input type="radio" name="initiator" value={role} checked={draft.initiator === role} onChange={() => update('initiator', role)} />
                  <span>{role === 'landlord' ? 'Landlord' : 'Tenant'}</span>
                </label>
              ))}
            </div>
            {errors.initiator ? <span className="field-error" id="initiator-error">{errors.initiator}</span> : null}
          </fieldset>
        </Card>

        <Card className="form-section">
          <div className="form-section-heading"><span>2</span><div><h2>The home</h2><p>Where is the residential property?</p></div></div>
          <div className="form-grid">
            <Select id="state" label="State or union territory" value={draft.state} onChange={(e) => update('state', e.target.value)} error={errors.state}>
              <option value="">Choose a state</option>
              {indianStatesAndTerritories.map((state) => <option value={state} key={state}>{state}</option>)}
            </Select>
            <Input id="city" label="City" value={draft.city} onChange={(e) => update('city', e.target.value)} error={errors.city} placeholder="e.g. Bengaluru" />
            <Select id="propertyType" label="Property type" value={draft.propertyType} onChange={(e) => update('propertyType', e.target.value as IntakeDraft['propertyType'])} error={errors.propertyType}>
              <option value="">Choose a property type</option>
              {propertyTypeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </Select>
            <Textarea id="address" label="Property address" value={draft.address} onChange={(e) => update('address', e.target.value)} error={errors.address} placeholder="Use a fictional address for this demo" rows={3} />
          </div>
        </Card>

        <Card className="form-section">
          <div className="form-section-heading"><span>3</span><div><h2>The tenancy</h2><p>Set the commercial terms.</p></div></div>
          <div className="form-grid">
            <Input id="monthlyRent" label="Monthly rent (₹)" value={draft.monthlyRent} onChange={(e) => update('monthlyRent', e.target.value.replace(/\D/g, ''))} error={errors.monthlyRent} inputMode="numeric" placeholder="40000" />
            <Input id="securityDeposit" label="Security deposit (₹)" value={draft.securityDeposit} onChange={(e) => update('securityDeposit', e.target.value.replace(/\D/g, ''))} error={errors.securityDeposit} inputMode="numeric" placeholder="120000" />
            <Input id="durationMonths" label="Duration (months)" value={draft.durationMonths} onChange={(e) => update('durationMonths', e.target.value.replace(/\D/g, '').slice(0, 2))} error={errors.durationMonths} inputMode="numeric" placeholder="11" />
            <Input id="startDate" label="Start date" type="date" value={draft.startDate} onChange={(e) => update('startDate', e.target.value)} error={errors.startDate} />
          </div>
        </Card>

        <Card className="form-section">
          <div className="form-section-heading"><span>4</span><div><h2>The people</h2><p>Use synthetic names for this hackathon demo.</p></div></div>
          <div className="form-grid">
            <Input id="landlordName" label="Landlord name" value={draft.landlordName} onChange={(e) => update('landlordName', e.target.value)} error={errors.landlordName} placeholder="Full name" />
            <Input id="tenantName" label="Tenant name" value={draft.tenantName} onChange={(e) => update('tenantName', e.target.value)} error={errors.tenantName} placeholder="Full name" />
            <Input className="document-name-input" id="documentName" label="Document name" value={draft.documentName} onChange={(e) => update('documentName', e.target.value)} error={errors.documentName} hint="Suggested from both party names; you can customize it." />
          </div>
        </Card>

        <div className="form-actions">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button type="submit">Review what you need</Button>
        </div>
      </form>
    </main>
  )
}
