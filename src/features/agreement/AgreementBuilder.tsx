import { useMemo, useState, type ReactNode } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Textarea } from '../../components/ui/Textarea'
import {
  furnishingLabel,
  generateAgreement,
  resolveAgreementBuilderConfiguration,
} from '../../domain/agreementBuilder'
import type { AgreementBuilderConfiguration, AgreementState, InventoryItem } from '../../domain/types'

interface AgreementBuilderProps {
  agreement: AgreementState
  onChange: (configuration: AgreementBuilderConfiguration) => void
}

type CategoryId = 'basics' | 'rent' | 'term' | 'maintenance' | 'usage' | 'occupancy' | 'access' | 'parking' | 'furnishing' | 'custom'

const inventoryCategories: InventoryItem['category'][] = [
  'Furniture', 'Major appliances', 'Kitchen appliances', 'Kitchenware',
  'Fixtures & fittings', 'Electronics & smart devices', 'Keys & access',
]

const fullyFurnishedSuggestions: InventoryItem[] = [
  'Cookware', 'Plates / bowls', 'Glasses / cups', 'Cutlery', 'Cooking utensils', 'Storage containers',
].map((name) => ({ id: `suggested-${name.toLowerCase().replace(/\W+/g, '-')}`, category: 'Kitchenware', name, quantity: 1, condition: 'Good', notes: '' }))

fullyFurnishedSuggestions.push({ id: 'suggested-main-door-keys', category: 'Keys & access', name: 'Main-door keys', quantity: 2, condition: 'Good', notes: '' })

function Category({
  id,
  title,
  description,
  status,
  enabled = true,
  locked = false,
  expanded,
  onExpand,
  onToggle,
  children,
}: {
  id: CategoryId
  title: string
  description: string
  status: string
  enabled?: boolean
  locked?: boolean
  expanded: boolean
  onExpand: () => void
  onToggle?: (enabled: boolean) => void
  children: ReactNode
}) {
  return (
    <section className={`builder-category ${enabled ? 'builder-category-enabled' : ''}`}>
      <div className="builder-category-header">
        <label className="category-check" title={locked ? 'Essential sections are always included' : undefined}>
          <input type="checkbox" checked={enabled} disabled={locked} onChange={(event) => onToggle?.(event.target.checked)} />
          <span aria-hidden="true">✓</span>
        </label>
        <button type="button" className="category-expand" aria-expanded={expanded} aria-controls={`category-${id}`} onClick={onExpand}>
          <span><strong>{title}</strong><small>{description}</small></span>
          <span className="category-status">{status}</span>
          <span className="category-chevron" aria-hidden="true">⌄</span>
        </button>
      </div>
      {expanded ? <div className="builder-category-body" id={`category-${id}`}>{children}</div> : null}
      {!enabled ? <p className="category-warning">Usually included to avoid ambiguity later.</p> : null}
    </section>
  )
}

function Toggle({ checked, label, onChange, disabled = false }: { checked: boolean; label: string; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="builder-toggle"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>
}

function AgreementPreview({ agreement, configuration, onClose }: { agreement: AgreementState; configuration: AgreementBuilderConfiguration; onClose?: () => void }) {
  const generated = useMemo(() => generateAgreement(agreement, configuration), [agreement, configuration])
  return (
    <article className={`agreement-preview ${onClose ? 'agreement-preview-mobile' : ''}`} aria-label="Agreement preview" role={onClose ? 'dialog' : undefined} aria-modal={onClose ? true : undefined}>
      {onClose ? <div className="preview-mobile-bar"><strong>Agreement preview</strong><Button variant="ghost" onClick={onClose}>Close</Button></div> : null}
      <div className="agreement-paper">
        <p className="document-kicker">Saral Setu · Draft</p>
        <h2>{generated.title}</h2>
        <p className="document-intro">This agreement records the residential tenancy terms chosen by the parties.</p>
        <div className="document-clauses">
          {generated.clauses.map((clause, index) => (
            <section key={clause.id} data-clause-id={clause.id}>
              <h3>{index + 1}. {clause.title}</h3>
              <p>{clause.text}</p>
            </section>
          ))}
        </div>
        {generated.inventory.length ? (
          <section className="inventory-schedule">
            <h3>Schedule A — Furnishings, Fixtures &amp; Inventory</h3>
            <div className="inventory-table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Condition</th><th>Notes</th></tr></thead><tbody>
              {generated.inventory.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.quantity}</td><td>{item.condition}</td><td>{item.notes || '—'}</td></tr>)}
            </tbody></table></div>
          </section>
        ) : null}
        <p className="document-disclaimer">This demo helps the parties express agreed terms. It is not legal advice.</p>
      </div>
    </article>
  )
}

function setMembership(values: string[], value: string, enabled: boolean): string[] {
  return enabled ? [...new Set([...values, value])] : values.filter((item) => item !== value)
}

export function AgreementBuilder({ agreement, onChange }: AgreementBuilderProps) {
  const configuration = resolveAgreementBuilderConfiguration(agreement)
  const generated = useMemo(() => generateAgreement(agreement, configuration), [agreement, configuration])
  const [expanded, setExpanded] = useState<Set<CategoryId>>(() => new Set(['basics', 'rent']))
  const [mobilePreview, setMobilePreview] = useState(false)

  function toggleExpanded(id: CategoryId) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function update<K extends keyof AgreementBuilderConfiguration>(key: K, value: AgreementBuilderConfiguration[K]) {
    onChange({ ...configuration, [key]: value })
  }

  function updateInventory(id: string, patch: Partial<InventoryItem>) {
    update('furnishing', {
      ...configuration.furnishing,
      inventory: configuration.furnishing.inventory.map((item) => item.id === id ? { ...item, ...patch } : item),
    })
  }

  function addInventoryItem(category: InventoryItem['category']) {
    update('furnishing', {
      ...configuration.furnishing,
      inventory: [...configuration.furnishing.inventory, {
        id: `item-${Date.now()}`,
        category,
        name: 'Custom item',
        quantity: 1,
        condition: 'Not checked',
        notes: '',
      }],
    })
  }

  function changeFurnishingLevel(level: AgreementBuilderConfiguration['furnishing']['level']) {
    const suggestions = level === 'fully-furnished' ? fullyFurnishedSuggestions : []
    const existingNames = new Set(configuration.furnishing.inventory.map((item) => item.name))
    update('furnishing', {
      level,
      inventory: [...configuration.furnishing.inventory, ...suggestions.filter((item) => !existingNames.has(item.name))],
    })
  }

  const categoryProps = (id: CategoryId) => ({ expanded: expanded.has(id), onExpand: () => toggleExpanded(id) })

  return (
    <div className="agreement-builder-screen">
      <div className="builder-heading">
        <div><p className="eyebrow">Build your agreement</p><h1>Choose what matters for your home.</h1><p className="lede">We’ll turn your choices into a clear agreement. Essential terms are already protected.</p></div>
        <Button variant="secondary" className="mobile-preview-button" onClick={() => setMobilePreview(true)}>Preview Agreement</Button>
      </div>

      <div className="agreement-builder-grid">
        <div className="builder-config" aria-label="Customize your agreement">
          <div className="builder-panel-title"><span>Customize your agreement</span><small>Product defaults for this demo</small></div>

          <Category id="basics" title="Agreement Basics" description="Parties, home and tenancy details" status="Essential" locked {...categoryProps('basics')}>
            <div className="review-detail-grid">
              <span><small>Landlord</small><strong>{agreement.landlord.name}</strong></span>
              <span><small>Tenant</small><strong>{agreement.tenant.name}</strong></span>
              <span className="wide"><small>Property</small><strong>{agreement.property.address}, {agreement.property.city}</strong></span>
              <span><small>Starts</small><strong>{agreement.startDate}</strong></span>
              <span><small>Duration</small><strong>{agreement.durationMonths} months</strong></span>
              <span className="wide"><small>Signatures / execution</small><strong>Landlord + Tenant</strong></span>
            </div>
          </Category>

          <Category id="rent" title="Rent & Deposit" description="Payment and deposit return terms" status="Essential" locked {...categoryProps('rent')}>
            <div className="builder-subsection"><div className="subsection-title"><strong>Monthly rent</strong><Badge tone="accent">Essential</Badge></div><p className="configured-value">₹{agreement.monthlyRent.toLocaleString('en-IN')}</p>
              <div className="builder-fields two-columns"><Input label="Payment due day" type="number" min="1" max="28" value={configuration.rent.dueDay} onChange={(event) => update('rent', { ...configuration.rent, dueDay: Number(event.target.value) })} /><div className="field"><span className="field-label">Payment mode</span>{['Bank transfer / UPI', 'Cash', 'Other'].map((mode) => <Toggle key={mode} label={mode} checked={configuration.rent.paymentModes.includes(mode)} onChange={(checked) => update('rent', { ...configuration.rent, paymentModes: setMembership(configuration.rent.paymentModes, mode, checked) })} />)}</div></div>
            </div>
            <div className="builder-subsection"><Toggle label="Include late-payment terms" checked={configuration.rent.latePaymentEnabled} onChange={(checked) => update('rent', { ...configuration.rent, latePaymentEnabled: checked })} />{configuration.rent.latePaymentEnabled ? <div className="builder-fields two-columns"><Input label="Grace period (days)" type="number" min="0" value={configuration.rent.graceDays} onChange={(event) => update('rent', { ...configuration.rent, graceDays: Number(event.target.value) })} /><Input label="What happens next" value={configuration.rent.latePaymentConsequence} onChange={(event) => update('rent', { ...configuration.rent, latePaymentConsequence: event.target.value })} /></div> : null}</div>
            <div className="builder-subsection"><Toggle label="Rent escalation" checked={configuration.rent.escalationEnabled} onChange={(checked) => update('rent', { ...configuration.rent, escalationEnabled: checked })} />{configuration.rent.escalationEnabled ? <div className="builder-fields two-columns"><Input label="Increase (%)" type="number" min="0" value={configuration.rent.escalationPercent} onChange={(event) => update('rent', { ...configuration.rent, escalationPercent: Number(event.target.value) })} /><Input label="After (months)" type="number" min="1" value={configuration.rent.escalationAfterMonths} onChange={(event) => update('rent', { ...configuration.rent, escalationAfterMonths: Number(event.target.value) })} /></div> : null}</div>
            <div className="builder-subsection"><div className="subsection-title"><strong>Security deposit</strong><Badge tone="accent">Essential</Badge></div><p className="configured-value">₹{agreement.securityDeposit.toLocaleString('en-IN')}</p><Input label="Refund within (days after handover)" type="number" min="0" value={configuration.deposit.refundDays} onChange={(event) => update('deposit', { ...configuration.deposit, refundDays: Number(event.target.value) })} /><p className="field-label">Deductions permitted for</p>{['Unpaid rent', 'Outstanding utility bills', 'Damage beyond normal wear and tear', 'Other agreed charges'].map((deduction) => <Toggle key={deduction} label={deduction} checked={configuration.deposit.deductions.includes(deduction)} onChange={(checked) => update('deposit', { ...configuration.deposit, deductions: setMembership(configuration.deposit.deductions, deduction, checked) })} />)}<details className="plain-explanation"><summary>What does normal wear and tear mean?</summary><p>Ordinary change from everyday use, rather than avoidable damage.</p></details></div>
          </Category>

          <Category id="term" title="Duration & Exit" description="Notice, renewal and early exit" status="Included" {...categoryProps('term')}>
            <p className="configured-value">{agreement.durationMonths} months</p>
            <Toggle label="Notice period" checked={configuration.term.noticeEnabled} onChange={(checked) => update('term', { ...configuration.term, noticeEnabled: checked })} />{configuration.term.noticeEnabled ? <Select label="Either party must provide" value={configuration.term.noticePeriod} onChange={(event) => update('term', { ...configuration.term, noticePeriod: event.target.value })}><option>15 days</option><option>1 month</option><option>2 months</option></Select> : null}
            <Toggle label="Lock-in period" checked={configuration.term.lockInEnabled} onChange={(checked) => update('term', { ...configuration.term, lockInEnabled: checked })} />{configuration.term.lockInEnabled ? <div className="builder-fields two-columns"><Input label="Lock-in (months)" type="number" min="1" value={configuration.term.lockInMonths} onChange={(event) => update('term', { ...configuration.term, lockInMonths: Number(event.target.value) })} /><Select label="Applies to" value={configuration.term.lockInAppliesTo} onChange={(event) => update('term', { ...configuration.term, lockInAppliesTo: event.target.value as AgreementBuilderConfiguration['term']['lockInAppliesTo'] })}><option>both parties</option><option>tenant</option><option>landlord</option></Select></div> : null}
            <Toggle label="Renewal terms" checked={configuration.term.renewalEnabled} onChange={(checked) => update('term', { ...configuration.term, renewalEnabled: checked })} />{configuration.term.renewalEnabled ? <Select label="Renewal method" value={configuration.term.renewalType} onChange={(event) => update('term', { ...configuration.term, renewalType: event.target.value as AgreementBuilderConfiguration['term']['renewalType'] })}><option>mutual written agreement</option><option>automatic renewal</option></Select> : null}
            <Toggle label="Early termination reasons" checked={configuration.term.earlyTerminationEnabled} onChange={(checked) => update('term', { ...configuration.term, earlyTerminationEnabled: checked })} />
            {configuration.term.earlyTerminationEnabled ? <div>{['Non-payment of rent', 'Material breach of agreement', 'Illegal use of premises', 'Other agreed reason'].map((reason) => <Toggle key={reason} label={reason} checked={configuration.term.earlyTerminationReasons.includes(reason)} onChange={(checked) => update('term', { ...configuration.term, earlyTerminationReasons: setMembership(configuration.term.earlyTerminationReasons, reason, checked) })} />)}</div> : null}
          </Category>

          <Category id="maintenance" title="Maintenance & Utilities" description="Who pays and who repairs" status={(configuration.maintenance.enabled || configuration.utilities.enabled || configuration.repairs.enabled) ? 'Included' : 'Not included'} enabled={configuration.maintenance.enabled || configuration.utilities.enabled || configuration.repairs.enabled} onToggle={(enabled) => onChange({ ...configuration, maintenance: { ...configuration.maintenance, enabled }, utilities: { ...configuration.utilities, enabled }, repairs: { ...configuration.repairs, enabled } })} {...categoryProps('maintenance')}>
            <Toggle label="Society / maintenance charges" checked={configuration.maintenance.enabled} onChange={(enabled) => update('maintenance', { ...configuration.maintenance, enabled })} />{configuration.maintenance.enabled ? <div className="builder-fields two-columns"><Select label="Regular charges paid by" value={configuration.maintenance.regularChargesPaidBy} onChange={(event) => update('maintenance', { ...configuration.maintenance, regularChargesPaidBy: event.target.value as AgreementBuilderConfiguration['maintenance']['regularChargesPaidBy'] })}><option value="landlord">Landlord</option><option value="tenant">Tenant</option><option value="included">Included in rent</option></Select><Select label="Major assessments paid by" value={configuration.maintenance.majorAssessmentsPaidBy} onChange={(event) => update('maintenance', { ...configuration.maintenance, majorAssessmentsPaidBy: event.target.value as 'landlord' | 'tenant' })}><option value="landlord">Landlord</option><option value="tenant">Tenant</option></Select></div> : null}
            <Toggle label="Utilities" checked={configuration.utilities.enabled} onChange={(enabled) => update('utilities', { ...configuration.utilities, enabled })} />{configuration.utilities.enabled ? <div className="utility-list">{configuration.utilities.items.map((item, index) => <div key={item.name} className="utility-row"><Toggle label={item.name} checked={item.enabled} onChange={(enabled) => update('utilities', { ...configuration.utilities, items: configuration.utilities.items.map((current, currentIndex) => currentIndex === index ? { ...current, enabled } : current) })} /><select aria-label={`${item.name} paid by`} value={item.paidBy} onChange={(event) => update('utilities', { ...configuration.utilities, items: configuration.utilities.items.map((current, currentIndex) => currentIndex === index ? { ...current, paidBy: event.target.value as 'landlord' | 'tenant' } : current) })}><option value="tenant">Tenant</option><option value="landlord">Landlord</option></select></div>)}</div> : null}
            <Toggle label="Repairs and damage" checked={configuration.repairs.enabled} onChange={(enabled) => update('repairs', { ...configuration.repairs, enabled })} />{configuration.repairs.enabled ? <div className="builder-fields two-columns"><Textarea label="Tenant responsibilities" value={configuration.repairs.tenantResponsibilities.join(', ')} onChange={(event) => update('repairs', { ...configuration.repairs, tenantResponsibilities: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /><Textarea label="Landlord responsibilities" value={configuration.repairs.landlordResponsibilities.join(', ')} onChange={(event) => update('repairs', { ...configuration.repairs, landlordResponsibilities: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></div> : null}
          </Category>

          <Category id="usage" title="Property Usage" description="Residential use, subletting and alterations" status={configuration.usage.enabled ? 'Included' : 'Not included'} enabled={configuration.usage.enabled} onToggle={(enabled) => update('usage', { ...configuration.usage, enabled })} {...categoryProps('usage')}>
            <Toggle label="Residential use" checked disabled onChange={() => undefined} />
            <Toggle label="Work from home permitted" checked={configuration.usage.workFromHome} onChange={(workFromHome) => update('usage', { ...configuration.usage, workFromHome })} />
            <Toggle label="Include subletting terms" checked={configuration.usage.sublettingEnabled} onChange={(sublettingEnabled) => update('usage', { ...configuration.usage, sublettingEnabled })} />{configuration.usage.sublettingEnabled ? <Select label="Subletting" value={configuration.usage.subletting} onChange={(event) => update('usage', { ...configuration.usage, subletting: event.target.value as AgreementBuilderConfiguration['usage']['subletting'] })}><option value="written consent required">Not allowed without written consent</option><option value="allowed">Allowed</option></Select> : null}
            <Toggle label="Material alterations require landlord approval" checked={configuration.usage.alterationsEnabled} onChange={(alterationsEnabled) => update('usage', { ...configuration.usage, alterationsEnabled })} />
          </Category>

          <Category id="occupancy" title="Occupancy & Pets" description="Occupants, guests and pets" status={configuration.occupancy.enabled ? 'Included' : 'Not included'} enabled={configuration.occupancy.enabled} onToggle={(enabled) => update('occupancy', { ...configuration.occupancy, enabled })} {...categoryProps('occupancy')}>
            <div className="occupant-list">{configuration.occupancy.occupants.map((occupant) => <div className="occupant-row" key={occupant.id}><Input label="Occupant name" value={occupant.name} onChange={(event) => update('occupancy', { ...configuration.occupancy, occupants: configuration.occupancy.occupants.map((item) => item.id === occupant.id ? { ...item, name: event.target.value } : item) })} /><Input label="Relationship" value={occupant.relationship} onChange={(event) => update('occupancy', { ...configuration.occupancy, occupants: configuration.occupancy.occupants.map((item) => item.id === occupant.id ? { ...item, relationship: event.target.value } : item) })} /><Button variant="ghost" onClick={() => update('occupancy', { ...configuration.occupancy, occupants: configuration.occupancy.occupants.filter((item) => item.id !== occupant.id) })}>Remove</Button></div>)}</div>
            <Button variant="secondary" onClick={() => update('occupancy', { ...configuration.occupancy, occupants: [...configuration.occupancy.occupants, { id: `occupant-${Date.now()}`, name: '', relationship: '' }] })}>+ Add occupant</Button>
            <Toggle label="Guest-stay conditions" checked={configuration.occupancy.guestConditionsEnabled} onChange={(guestConditionsEnabled) => update('occupancy', { ...configuration.occupancy, guestConditionsEnabled })} />{configuration.occupancy.guestConditionsEnabled ? <Input label="Guest conditions" value={configuration.occupancy.guestConditions} onChange={(event) => update('occupancy', { ...configuration.occupancy, guestConditions: event.target.value })} /> : null}
            <Toggle label="Include pet clause" checked={configuration.occupancy.petsEnabled} onChange={(petsEnabled) => update('occupancy', { ...configuration.occupancy, petsEnabled })} />{configuration.occupancy.petsEnabled ? <><Select label="Pets" value={configuration.occupancy.pets} onChange={(event) => update('occupancy', { ...configuration.occupancy, pets: event.target.value as AgreementBuilderConfiguration['occupancy']['pets'] })}><option value="allowed">Pets allowed</option><option value="allowed with conditions">Pets allowed with conditions</option><option value="not permitted">Pets not permitted</option></Select>{configuration.occupancy.pets === 'allowed with conditions' ? <Input label="Pet conditions" value={configuration.occupancy.petConditions} onChange={(event) => update('occupancy', { ...configuration.occupancy, petConditions: event.target.value })} /> : null}</> : null}
          </Category>

          <Category id="access" title="Property Access" description="Inspection notice and emergencies" status={configuration.access.enabled ? 'Included' : 'Not included'} enabled={configuration.access.enabled} onToggle={(enabled) => update('access', { ...configuration.access, enabled })} {...categoryProps('access')}>
            <Input label="Prior notice (hours)" type="number" min="0" value={configuration.access.noticeHours} onChange={(event) => update('access', { ...configuration.access, noticeHours: Number(event.target.value) })} />
            <Toggle label="Emergency situations are an exception" checked={configuration.access.emergencyException} onChange={(emergencyException) => update('access', { ...configuration.access, emergencyException })} />
          </Category>

          <Category id="parking" title="Parking & Restoration" description="Optional parking and move-out terms" status={(configuration.parking.enabled || configuration.restoration.enabled) ? 'Included' : 'Not included'} enabled={configuration.parking.enabled || configuration.restoration.enabled} onToggle={(enabled) => onChange({ ...configuration, parking: { ...configuration.parking, enabled }, restoration: enabled ? configuration.restoration : { ...configuration.restoration, enabled: false } })} {...categoryProps('parking')}>
            <Toggle label="Parking included" checked={configuration.parking.enabled} onChange={(enabled) => update('parking', { ...configuration.parking, enabled })} />{configuration.parking.enabled ? <div className="builder-fields two-columns"><Select label="Parking type" value={configuration.parking.type} onChange={(event) => update('parking', { ...configuration.parking, type: event.target.value as AgreementBuilderConfiguration['parking']['type'] })}><option value="car">Car</option><option value="two-wheeler">Two-wheeler</option><option value="both">Both</option></Select><Input label="Parking identifier" placeholder="B-42" value={configuration.parking.identifier} onChange={(event) => update('parking', { ...configuration.parking, identifier: event.target.value })} /></div> : null}
            <Toggle label="Include move-out restoration terms" checked={configuration.restoration.enabled} onChange={(enabled) => update('restoration', { ...configuration.restoration, enabled })} />{configuration.restoration.enabled ? <Select label="Restoration approach" value={configuration.restoration.type} onChange={(event) => update('restoration', { ...configuration.restoration, type: event.target.value as AgreementBuilderConfiguration['restoration']['type'] })}><option value="same condition">Same condition, excluding normal wear</option><option value="agreed painting cost">Painting cost deducted as agreed</option><option value="custom">Custom</option></Select> : null}{configuration.restoration.enabled && configuration.restoration.type === 'custom' ? <Input label="Custom restoration term" value={configuration.restoration.customText} onChange={(event) => update('restoration', { ...configuration.restoration, customText: event.target.value })} /> : null}
          </Category>

          <Category id="furnishing" title="Furnishing & Inventory" description="Furniture, appliances and access items" status={`${furnishingLabel(configuration.furnishing.level)} · ${configuration.furnishing.inventory.length} items`} locked {...categoryProps('furnishing')}>
            <Select label="How is the property furnished?" value={configuration.furnishing.level} onChange={(event) => changeFurnishingLevel(event.target.value as AgreementBuilderConfiguration['furnishing']['level'])}><option value="unfurnished">Unfurnished</option><option value="semi-furnished">Semi-furnished</option><option value="fully-furnished">Fully furnished</option></Select>
            {configuration.furnishing.level !== 'unfurnished' ? inventoryCategories.map((category) => <details className="inventory-category" key={category} open={category === 'Furniture'}><summary>{category} <span>{configuration.furnishing.inventory.filter((item) => item.category === category).length} items</span></summary><div className="inventory-editor">{configuration.furnishing.inventory.filter((item) => item.category === category).map((item) => <div className="inventory-edit-row" key={item.id}><Input label="Item" value={item.name} onChange={(event) => updateInventory(item.id, { name: event.target.value })} /><Input label="Quantity" type="number" min="1" value={item.quantity} onChange={(event) => updateInventory(item.id, { quantity: Number(event.target.value) })} /><Select label="Condition" value={item.condition} onChange={(event) => updateInventory(item.id, { condition: event.target.value as InventoryItem['condition'] })}><option>New</option><option>Good</option><option>Fair</option><option>Existing damage</option><option>Not checked</option></Select><Input label="Notes" value={item.notes} onChange={(event) => updateInventory(item.id, { notes: event.target.value })} /><Button variant="ghost" onClick={() => update('furnishing', { ...configuration.furnishing, inventory: configuration.furnishing.inventory.filter((current) => current.id !== item.id) })}>Remove</Button></div>)}<Button variant="secondary" onClick={() => addInventoryItem(category)}>+ Add custom item</Button></div></details>) : <p className="muted">No inventory schedule will be added for an unfurnished property.</p>}
            <Toggle label="Record move-in meter readings" checked={configuration.meterReadings.enabled} onChange={(enabled) => update('meterReadings', { ...configuration.meterReadings, enabled })} />{configuration.meterReadings.enabled ? <div className="builder-fields three-columns">{configuration.utilities.items.some((item) => item.enabled && item.name === 'Electricity') ? <Input label="Electricity" value={configuration.meterReadings.electricity} onChange={(event) => update('meterReadings', { ...configuration.meterReadings, electricity: event.target.value })} /> : null}{configuration.utilities.items.some((item) => item.enabled && item.name === 'Water') ? <Input label="Water" value={configuration.meterReadings.water} onChange={(event) => update('meterReadings', { ...configuration.meterReadings, water: event.target.value })} /> : null}{configuration.utilities.items.some((item) => item.enabled && item.name === 'Piped gas') ? <Input label="Gas" value={configuration.meterReadings.gas} onChange={(event) => update('meterReadings', { ...configuration.meterReadings, gas: event.target.value })} /> : null}</div> : null}
          </Category>

          <Category id="custom" title="Additional Terms" description="Plain-language conditions you agree" status={configuration.customTerms.length ? `${configuration.customTerms.length} added` : 'None'} locked {...categoryProps('custom')}>
            {configuration.customTerms.map((term, index) => <div className="custom-term-row" key={term.id}><Textarea label={`Custom term ${index + 1}`} value={term.text} placeholder="Tenant can install a wall-mounted television with landlord approval." onChange={(event) => update('customTerms', configuration.customTerms.map((item) => item.id === term.id ? { ...item, text: event.target.value } : item))} /><Button variant="ghost" onClick={() => update('customTerms', configuration.customTerms.filter((item) => item.id !== term.id))}>Remove</Button></div>)}
            <Button variant="secondary" onClick={() => update('customTerms', [...configuration.customTerms, { id: `term-${Date.now()}`, text: '' }])}>Add another term</Button>
          </Category>

          <div className="agreement-summary"><div><p className="eyebrow">Your agreement</p><strong>{generated.clauses.length} clauses included</strong></div><span>{generated.optionalClauseCount} optional clauses selected</span><span>{generated.inventory.length} inventory items recorded</span></div>
        </div>
        <AgreementPreview agreement={agreement} configuration={configuration} />
      </div>
      {mobilePreview ? <AgreementPreview agreement={agreement} configuration={configuration} onClose={() => setMobilePreview(false)} /> : null}
    </div>
  )
}
