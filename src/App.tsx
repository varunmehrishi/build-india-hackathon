import { useState } from 'react'
import { Badge } from './components/ui/Badge'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { PageContainer } from './components/ui/PageContainer'
import { Stepper } from './components/ui/Stepper'
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type DemoAuthSession,
} from './domain/auth'
import { createInitialAgreementState, workflowStepOrder, workflowSteps } from './domain/demoData'
import { applyIntakeDraft, emptyIntakeDraft } from './domain/intake'
import type { AgreementState, IntakeDraft, WorkflowStep } from './domain/types'
import { AuthGate } from './features/auth/AuthGate'
import { DetailsScreen } from './features/intake/DetailsScreen'
import { IntentScreen } from './features/intake/IntentScreen'

function App() {
  const [authSession, setAuthSession] = useState<DemoAuthSession | null>(() => loadAuthSession())
  const [state, setState] = useState<AgreementState>(() => createInitialAgreementState())
  const [draft, setDraft] = useState<IntakeDraft>(() => ({ ...emptyIntakeDraft }))
  const [furthestStepIndex, setFurthestStepIndex] = useState(0)

  const activeIndex = workflowStepOrder.indexOf(state.workflowStep)
  const activeStep = workflowSteps[activeIndex]

  function resetWorkflow() {
    setState(createInitialAgreementState())
    setDraft({ ...emptyIntakeDraft })
    setFurthestStepIndex(0)
  }

  function authenticate(session: DemoAuthSession) {
    saveAuthSession(session)
    setAuthSession(session)
  }

  function logout() {
    clearAuthSession()
    resetWorkflow()
    setAuthSession(null)
  }

  function updateWorkflowStep(step: WorkflowStep) {
    const nextIndex = workflowStepOrder.indexOf(step)
    if (nextIndex <= furthestStepIndex) {
      setState((current) => ({ ...current, workflowStep: step }))
    }
  }

  function moveStep(offset: number) {
    const nextIndex = Math.max(0, Math.min(workflowSteps.length - 1, activeIndex + offset))
    setFurthestStepIndex((current) => Math.max(current, nextIndex))
    setState((current) => ({ ...current, workflowStep: workflowSteps[nextIndex].id }))
  }

  function beginRentWorkflow(intentText: string) {
    setState((current) => ({ ...current, intentText, workflowStep: 'details' }))
    setFurthestStepIndex((current) => Math.max(current, 1))
  }

  function submitDetails(nextDraft: IntakeDraft) {
    setState((current) => applyIntakeDraft(current, nextDraft))
    setFurthestStepIndex((current) => Math.max(current, 2))
  }

  return (
    <PageContainer>
      <div
        className={authSession ? 'app-frame' : 'app-frame app-frame-locked'}
        aria-hidden={authSession ? undefined : true}
        inert={authSession ? undefined : true}
      >
        <header className="site-header">
          <button type="button" className="brand" onClick={resetWorkflow} aria-label="Build India home">
            <span className="brand-mark" aria-hidden="true">BI</span>
            <span><strong>Build India</strong><small>Legal journeys, simplified</small></span>
          </button>
          <nav className="header-actions" aria-label="Demo controls">
            <Badge tone="accent">Hackathon demo</Badge>
            {authSession ? <span className="citizen-name">{authSession.displayName}</span> : null}
            <Button variant="ghost" onClick={resetWorkflow}>Reset Demo</Button>
            {authSession ? <Button variant="secondary" onClick={logout}>Logout</Button> : null}
          </nav>
        </header>

        {state.workflowStep === 'intent' ? (
          <IntentScreen initialValue={state.intentText} onContinue={beginRentWorkflow} />
        ) : state.workflowStep === 'details' ? (
          <DetailsScreen
            draft={draft}
            onDraftChange={setDraft}
            onBack={() => updateWorkflowStep('intent')}
            onSubmit={submitDetails}
          />
        ) : (
          <div className="journey-layout">
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
                  maxSelectableIndex={furthestStepIndex}
                />
              </Card>
            </aside>

            <main className="content" id="main-content">
              <Card className="stage-card">
                <div className="section-heading">
                  <p className="eyebrow">{activeStep.kicker}</p>
                  <h1>{activeStep.title}</h1>
                </div>
                <p className="stage-description">{activeStep.description}</p>
                <div className="transaction-summary">
                  <span><small>Transaction</small><strong>{state.durationMonths}-month residential tenancy</strong></span>
                  <span><small>Location</small><strong>{state.property.city}, {state.property.state}</strong></span>
                  <span><small>Rent</small><strong>₹{state.monthlyRent.toLocaleString('en-IN')} / month</strong></span>
                </div>
                <div className="placeholder-panel">
                  <p className="placeholder-title">Coming in the next milestone</p>
                  <ul className="placeholder-list">
                    {activeStep.placeholderPoints.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </div>
              </Card>
              <div className="journey-actions">
                <Button variant="ghost" onClick={() => moveStep(-1)}>Back</Button>
                <Button onClick={() => moveStep(1)} disabled={activeIndex === workflowSteps.length - 1}>
                  Continue
                </Button>
              </div>
            </main>
          </div>
        )}
      </div>

      {!authSession ? <AuthGate onAuthenticated={authenticate} /> : null}
    </PageContainer>
  )
}

export default App
