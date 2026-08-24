import { useState } from 'react'
import { Badge } from './components/ui/Badge'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { Input } from './components/ui/Input'
import { PageContainer } from './components/ui/PageContainer'
import { Stepper } from './components/ui/Stepper'
import { createInitialAgreementState, workflowStepOrder, workflowSteps } from './domain/demoData'
import type { AgreementState, WorkflowStep } from './domain/types'

function App() {
  const [state, setState] = useState<AgreementState>(() => createInitialAgreementState())

  const activeIndex = workflowStepOrder.indexOf(state.workflowStep)
  const activeStep = workflowSteps[activeIndex]

  function updateWorkflowStep(step: WorkflowStep) {
    setState((current) => ({ ...current, workflowStep: step }))
  }

  function moveStep(offset: number) {
    const nextIndex = Math.max(0, Math.min(workflowSteps.length - 1, activeIndex + offset))
    updateWorkflowStep(workflowSteps[nextIndex].id)
  }

  function resetDemo() {
    setState(createInitialAgreementState())
  }

  return (
    <PageContainer>
      <div className="shell">
        <header className="hero card">
          <div className="hero-topline">
            <Badge tone="accent">Build India Hackathon</Badge>
            <Badge tone="neutral">Milestone 1 scaffold</Badge>
          </div>
          <div className="hero-copy">
            <p className="eyebrow">Rent agreement workflow</p>
            <h1>What do you need to get done?</h1>
            <p className="lede">
              The app shell is wired for the full 11-month Bengaluru rent-agreement journey,
              but the detailed screens are still placeholders.
            </p>
          </div>
          <div className="hero-actions">
            <Button onClick={resetDemo}>Reset Demo</Button>
            <Button variant="secondary" onClick={() => moveStep(1)}>
              Jump forward
            </Button>
          </div>
        </header>

        <div className="layout">
          <aside className="sidebar">
            <Card>
              <div className="section-heading">
                <p className="eyebrow">Journey</p>
                <h2>Workflow steps</h2>
              </div>
              <Stepper
                steps={workflowSteps}
                activeStepId={state.workflowStep}
                onSelectStep={updateWorkflowStep}
              />
            </Card>

            <Card>
              <div className="section-heading">
                <p className="eyebrow">Demo state</p>
                <h2>Scenario snapshot</h2>
              </div>
              <dl className="summary-grid">
                <div>
                  <dt>City</dt>
                  <dd>{state.property.city}</dd>
                </div>
                <div>
                  <dt>State</dt>
                  <dd>{state.property.state}</dd>
                </div>
                <div>
                  <dt>Monthly rent</dt>
                  <dd>INR {state.monthlyRent.toLocaleString('en-IN')}</dd>
                </div>
                <div>
                  <dt>Deposit</dt>
                  <dd>INR {state.securityDeposit.toLocaleString('en-IN')}</dd>
                </div>
                <div>
                  <dt>Term</dt>
                  <dd>{state.durationMonths} months</dd>
                </div>
                <div>
                  <dt>Start</dt>
                  <dd>{state.startDate}</dd>
                </div>
              </dl>
            </Card>
          </aside>

          <main className="content">
            <Card className="stage-card">
              <div className="section-heading">
                <p className="eyebrow">{activeStep.kicker}</p>
                <h2>
                  {activeIndex + 1}. {activeStep.title}
                </h2>
              </div>
              <p className="stage-description">{activeStep.description}</p>

              <div className="placeholder-panel">
                <p className="placeholder-title">What will appear here later</p>
                <ul className="placeholder-list">
                  {activeStep.placeholderPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </Card>

            <div className="grid two-up">
              <Card>
                <div className="section-heading">
                  <p className="eyebrow">Controlled data</p>
                  <h2>Demo inputs</h2>
                </div>
                <div className="field-grid">
                  <Input label="Landlord name" value={state.landlord.name} readOnly />
                  <Input label="Tenant name" value={state.tenant.name} readOnly />
                  <Input label="Property address" value={state.property.address} readOnly />
                  <Input label="Workflow state" value={state.workflowStep} readOnly />
                </div>
              </Card>

              <Card>
                <div className="section-heading">
                  <p className="eyebrow">Planned behavior</p>
                  <h2>Navigation</h2>
                </div>
                <p className="muted">
                  Placeholder screens are linked end to end so the full journey can be wired in
                  milestone by milestone.
                </p>
                <div className="action-stack">
                  <Button
                    variant="secondary"
                    onClick={() => moveStep(-1)}
                    disabled={activeIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => moveStep(1)}
                    disabled={activeIndex === workflowSteps.length - 1}
                  >
                    Next
                  </Button>
                </div>
              </Card>
            </div>

            <Card className="footer-card">
              <div>
                <p className="eyebrow">Build status</p>
                <h2>Repository bootstrap complete</h2>
              </div>
              <div className="status-row">
                <Badge tone="success">State model ready</Badge>
                <Badge tone="success">Pages base path set</Badge>
                <Badge tone="warning">Detailed screens pending</Badge>
              </div>
            </Card>
          </main>
        </div>
      </div>
    </PageContainer>
  )
}

export default App
