import { useEffect, useMemo, useState } from 'react'
import { Badge } from './components/ui/Badge'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { PageContainer } from './components/ui/PageContainer'
import { Stepper } from './components/ui/Stepper'
import {
  bindRole,
  clearAuthSession,
  restoreAuthSession,
  roleForAgreement,
  saveAuthSession,
  type DemoAuthSession,
} from './domain/auth'
import { createInitialAgreementState, workflowStepOrder, workflowSteps } from './domain/demoData'
import {
  applyIntakeDraft,
  emptyIntakeDraft,
  intakeDraftFromAgreement,
} from './domain/intake'
import {
  replaceSnapshotUrl,
  snapshotFromLocation,
  type WorkflowSnapshotEnvelope,
} from './domain/snapshot'
import type { AgreementState, IntakeDraft, PartyRole, WorkflowStep } from './domain/types'
import { AuthGate } from './features/auth/AuthGate'
import { ProfileMenu } from './features/auth/ProfileMenu'
import { DetailsScreen } from './features/intake/DetailsScreen'
import { IntentScreen } from './features/intake/IntentScreen'
import { ShareDialog } from './features/sharing/ShareDialog'

type AuthState = DemoAuthSession | null | undefined

function invitedPartyName(snapshot: WorkflowSnapshotEnvelope | null): string | undefined {
  if (!snapshot?.invitedRole) return undefined
  return snapshot.agreement[snapshot.invitedRole].name || undefined
}

function App() {
  const initialShare = useMemo(() => snapshotFromLocation(), [])
  const [pendingSnapshot, setPendingSnapshot] = useState<WorkflowSnapshotEnvelope | null>(
    initialShare?.ok ? initialShare.snapshot : null,
  )
  const [notice, setNotice] = useState(
    initialShare && !initialShare.ok ? initialShare.error : '',
  )
  const [authSession, setAuthSession] = useState<AuthState>(undefined)
  const [state, setState] = useState<AgreementState>(() => createInitialAgreementState())
  const [draft, setDraft] = useState<IntakeDraft>(() => ({ ...emptyIntakeDraft }))
  const [furthestStepIndex, setFurthestStepIndex] = useState(0)
  const [isShareOpen, setIsShareOpen] = useState(false)

  const activeIndex = workflowStepOrder.indexOf(state.workflowStep)
  const activeStep = workflowSteps[activeIndex]
  const activeRole = authSession
    ? roleForAgreement(authSession, state.agreementId) ?? (draft.initiator || undefined)
    : undefined

  useEffect(() => {
    let cancelled = false
    void restoreAuthSession().then((restored) => {
      if (cancelled) return
      if (restored && pendingSnapshot) {
        importSnapshot(restored, pendingSnapshot)
      } else {
        setAuthSession(restored)
      }
      if (initialShare && !initialShare.ok) replaceSnapshotUrl(null)
    })
    return () => { cancelled = true }
    // Bootstrap exactly once from the URL and local vault.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!state.intakeCompleted || pendingSnapshot) return
    try {
      replaceSnapshotUrl({
        codecVersion: 1,
        agreement: state,
        furthestStepIndex,
      })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The agreement URL could not be updated.')
    }
  }, [state, furthestStepIndex, pendingSnapshot])

  function persistSession(session: DemoAuthSession) {
    saveAuthSession(session)
    setAuthSession(session)
  }

  function importSnapshot(session: DemoAuthSession, snapshot: WorkflowSnapshotEnvelope) {
    const role = snapshot.invitedRole
      ?? roleForAgreement(session, snapshot.agreement.agreementId)
      ?? snapshot.agreement.initiator
    const sharedName = snapshot.agreement[role].name.trim()
    const namedSession = { ...session, displayName: sharedName || session.displayName }
    const boundSession = bindRole(namedSession, snapshot.agreement.agreementId, role)
    saveAuthSession(boundSession)
    setAuthSession(boundSession)
    setState(snapshot.agreement)
    setDraft(intakeDraftFromAgreement(snapshot.agreement))
    setFurthestStepIndex(snapshot.furthestStepIndex)
    setPendingSnapshot(null)
    setNotice(`Shared agreement loaded · revision ${snapshot.agreement.snapshotRevision}`)
  }

  function resetWorkflow() {
    setState(createInitialAgreementState())
    setDraft({ ...emptyIntakeDraft })
    setFurthestStepIndex(0)
    setPendingSnapshot(null)
    setNotice('')
    setIsShareOpen(false)
    replaceSnapshotUrl(null)
  }

  function authenticate(session: DemoAuthSession) {
    if (pendingSnapshot) importSnapshot(session, pendingSnapshot)
    else persistSession(session)
  }

  async function logout() {
    await clearAuthSession()
    resetWorkflow()
    setAuthSession(null)
  }

  function updateWorkflowStep(step: WorkflowStep) {
    const nextIndex = workflowStepOrder.indexOf(step)
    if (nextIndex > furthestStepIndex) return
    setState((current) => ({
      ...current,
      workflowStep: step,
      snapshotRevision: current.intakeCompleted ? current.snapshotRevision + 1 : current.snapshotRevision,
      lastUpdatedBy: current.intakeCompleted ? activeRole : current.lastUpdatedBy,
    }))
  }

  function moveStep(offset: number) {
    const nextIndex = Math.max(0, Math.min(workflowSteps.length - 1, activeIndex + offset))
    setFurthestStepIndex((current) => Math.max(current, nextIndex))
    setState((current) => ({
      ...current,
      workflowStep: workflowSteps[nextIndex].id,
      snapshotRevision: current.intakeCompleted ? current.snapshotRevision + 1 : current.snapshotRevision,
      lastUpdatedBy: current.intakeCompleted ? activeRole : current.lastUpdatedBy,
    }))
  }

  function beginRentWorkflow(intentText: string) {
    setState((current) => ({ ...current, intentText, workflowStep: 'details' }))
    setFurthestStepIndex((current) => Math.max(current, 1))
  }

  function updateProfileName(displayName: string) {
    if (!authSession) return
    persistSession({ ...authSession, displayName })

    if (state.workflowStep === 'details' || !state.intakeCompleted) {
      const role = draft.initiator
      if (role) {
        const field = role === 'landlord' ? 'landlordName' : 'tenantName'
        setDraft((current) => ({ ...current, [field]: displayName }))
      }
      return
    }

    const role = roleForAgreement(authSession, state.agreementId)
    if (role) {
      setState((current) => ({
        ...current,
        [role]: { ...current[role], name: displayName },
        snapshotRevision: current.snapshotRevision + 1,
        lastUpdatedBy: role,
      }))
    }
  }

  function updateDraft(nextDraft: IntakeDraft) {
    let adjusted = { ...nextDraft }
    const previousRole = draft.initiator
    const nextRole = adjusted.initiator

    if (authSession && nextRole !== previousRole) {
      if (previousRole && nextRole) {
        adjusted = {
          ...adjusted,
          landlordName: nextDraft.tenantName,
          tenantName: nextDraft.landlordName,
        }
      }
      const selectedField = nextRole === 'landlord' ? 'landlordName' : 'tenantName'
      adjusted[selectedField] = authSession.displayName
    }

    setDraft(adjusted)
    if (authSession && nextRole) {
      const selectedName = nextRole === 'landlord' ? adjusted.landlordName : adjusted.tenantName
      if (selectedName.trim().length >= 2 && selectedName.trim() !== authSession.displayName) {
        persistSession({ ...authSession, displayName: selectedName.trim() })
      }
    }
  }

  function submitDetails(nextDraft: IntakeDraft) {
    const role = nextDraft.initiator || 'tenant'
    const completed = applyIntakeDraft(state, nextDraft)
    const nextState: AgreementState = {
      ...completed,
      snapshotRevision: state.snapshotRevision + 1,
      lastUpdatedBy: role,
    }
    setState(nextState)
    setFurthestStepIndex((current) => Math.max(current, 2))
    if (authSession) persistSession(bindRole(authSession, nextState.agreementId, role))
  }

  if (authSession === undefined) {
    return (
      <PageContainer>
        <div className="bootstrap-loading" role="status">Opening your local workspace…</div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div
        className={authSession ? 'app-frame' : 'app-frame app-frame-locked'}
        aria-hidden={authSession && !isShareOpen ? undefined : true}
        inert={authSession && !isShareOpen ? undefined : true}
      >
        <header className="site-header">
          <button type="button" className="brand" onClick={resetWorkflow} aria-label="Build India home">
            <span className="brand-mark" aria-hidden="true">BI</span>
            <span><strong>Build India</strong><small>Legal journeys, simplified</small></span>
          </button>
          <nav className="header-actions" aria-label="Demo controls">
            <Badge tone="accent">Hackathon demo</Badge>
            {state.intakeCompleted && state.workflowStep !== 'details' && authSession && activeRole ? (
              <Button variant="ghost" onClick={() => setIsShareOpen(true)}>Share</Button>
            ) : null}
            <Button variant="ghost" onClick={resetWorkflow}>Reset Demo</Button>
            {authSession ? <ProfileMenu name={authSession.displayName} onSave={updateProfileName} /> : null}
            {authSession ? <Button variant="secondary" onClick={() => void logout()}>Logout</Button> : null}
          </nav>
        </header>

        {notice ? <div className="app-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div> : null}

        {state.workflowStep === 'intent' ? (
          <IntentScreen initialValue={state.intentText} onContinue={beginRentWorkflow} />
        ) : state.workflowStep === 'details' ? (
          <DetailsScreen
            draft={draft}
            onDraftChange={updateDraft}
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
                  <span><small>Snapshot</small><strong>Revision {state.snapshotRevision}</strong></span>
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
                <Button onClick={() => moveStep(1)} disabled={activeIndex === workflowSteps.length - 1}>Continue</Button>
              </div>
            </main>
          </div>
        )}
      </div>

      {!authSession ? (
        <AuthGate
          onAuthenticated={authenticate}
          suggestedDisplayName={invitedPartyName(pendingSnapshot)}
        />
      ) : null}

      {isShareOpen && authSession && activeRole ? (
        <ShareDialog
          agreement={state}
          furthestStepIndex={furthestStepIndex}
          activeRole={activeRole as PartyRole}
          onClose={() => setIsShareOpen(false)}
        />
      ) : null}
    </PageContainer>
  )
}

export default App
