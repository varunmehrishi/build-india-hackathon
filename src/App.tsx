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
import { workflowStepOrder, workflowSteps } from './domain/demoData'
import { applyIntakeDraft } from './domain/intake'
import { replaceSnapshotUrl, snapshotFromLocation, type WorkflowSnapshotEnvelope } from './domain/snapshot'
import type { IntakeDraft, WorkflowStep } from './domain/types'
import {
  activeDocument,
  addNewDocument,
  documentLabel,
  importSnapshot,
  loadWorkspace,
  replaceActiveWithNewDocument,
  saveWorkspace,
  updateDocument,
  type LocalWorkspace,
  type StoredDocument,
} from './domain/workspace'
import { AuthGate } from './features/auth/AuthGate'
import { ProfileMenu } from './features/auth/ProfileMenu'
import { FinalizedView } from './features/finalized/FinalizedView'
import { DetailsScreen } from './features/intake/DetailsScreen'
import { IntentScreen } from './features/intake/IntentScreen'
import { ShareDialog } from './features/sharing/ShareDialog'

type AuthState = DemoAuthSession | null | undefined

function roleName(snapshot: WorkflowSnapshotEnvelope | null): string | undefined {
  if (!snapshot?.invitedRole) return undefined
  return snapshot.agreement[snapshot.invitedRole].name || undefined
}

function storedRoleName(document: StoredDocument, role: 'landlord' | 'tenant'): string | undefined {
  const agreementName = document.agreement[role].name.trim()
  const draftName = (role === 'landlord'
    ? document.intakeDraft.landlordName
    : document.intakeDraft.tenantName).trim()
  return agreementName || draftName || undefined
}

function App() {
  const initialShare = useMemo(() => snapshotFromLocation(), [])
  const [workspace, setWorkspace] = useState<LocalWorkspace>(() => loadWorkspace())
  const [notice, setNotice] = useState(initialShare && !initialShare.ok ? initialShare.error : '')
  const [authSession, setAuthSession] = useState<AuthState>(undefined)
  const [shareSource, setShareSource] = useState<StoredDocument | null>(null)

  const document = activeDocument(workspace)
  const state = document.agreement
  const draft = document.intakeDraft
  const furthestStepIndex = document.furthestStepIndex
  const activeIndex = workflowStepOrder.indexOf(state.workflowStep)
  const activeStep = workflowSteps[activeIndex]
  const activeRole = document.localRole
    ?? (authSession ? roleForAgreement(authSession, state.agreementId) : undefined)
    ?? (draft.initiator || undefined)

  useEffect(() => {
    let cancelled = false
    void restoreAuthSession().then((restored) => {
      if (cancelled) return
      let nextWorkspace = workspace
      if (initialShare?.ok) {
        nextWorkspace = importSnapshot(workspace, initialShare.snapshot)
        saveWorkspace(nextWorkspace)
        setWorkspace(nextWorkspace)
        setNotice(`Shared agreement imported · revision ${initialShare.snapshot.agreement.snapshotRevision}`)
      }
      if (initialShare) replaceSnapshotUrl(null)

      if (restored) {
        const current = activeDocument(nextWorkspace)
        if (current.localRole) {
          const name = storedRoleName(current, current.localRole)
          restored = bindRole(
            { ...restored, displayName: name || restored.displayName },
            current.agreement.agreementId,
            current.localRole,
          )
          saveAuthSession(restored)
        }
      }
      setAuthSession(restored)
    })
    return () => { cancelled = true }
    // Bootstrap once from browser storage and the incoming URL package.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persistWorkspace(next: LocalWorkspace) {
    saveWorkspace(next)
    setWorkspace(next)
  }

  function mutateWorkspace(transform: (current: LocalWorkspace) => LocalWorkspace) {
    setWorkspace((current) => {
      const next = transform(current)
      saveWorkspace(next)
      return next
    })
  }

  function mutateActiveDocument(updater: (current: StoredDocument) => StoredDocument) {
    mutateWorkspace((current) => updateDocument(current, current.activeDocumentId, updater))
  }

  function persistSession(session: DemoAuthSession) {
    saveAuthSession(session)
    setAuthSession(session)
  }

  function resetWorkflow() {
    persistWorkspace(replaceActiveWithNewDocument(workspace))
    setNotice('Active document reset.')
    setShareSource(null)
    replaceSnapshotUrl(null)
  }

  function createDocument() {
    persistWorkspace(addNewDocument(workspace))
    setNotice('New document created.')
    setShareSource(null)
  }

  function selectDocument(agreementId: string) {
    const selected = workspace.documents[agreementId]
    if (!selected) return
    persistWorkspace({ ...workspace, activeDocumentId: agreementId })
    if (authSession && selected.localRole) {
      const name = storedRoleName(selected, selected.localRole)
      persistSession(bindRole(
        { ...authSession, displayName: name || authSession.displayName },
        agreementId,
        selected.localRole,
      ))
    }
    setNotice('')
    setShareSource(null)
  }

  function authenticate(session: DemoAuthSession) {
    let nextSession = session
    if (document.localRole) {
      const name = storedRoleName(document, document.localRole)
      nextSession = bindRole(
        { ...session, displayName: name || session.displayName },
        state.agreementId,
        document.localRole,
      )
    }
    persistSession(nextSession)
  }

  async function logout() {
    await clearAuthSession()
    setShareSource(null)
    setAuthSession(null)
  }

  function updateWorkflowStep(step: WorkflowStep) {
    if (state.finalized) return
    const nextIndex = workflowStepOrder.indexOf(step)
    if (nextIndex > furthestStepIndex) return
    mutateActiveDocument((current) => ({
      ...current,
      agreement: {
        ...current.agreement,
        workflowStep: step,
        snapshotRevision: current.agreement.intakeCompleted
          ? current.agreement.snapshotRevision + 1
          : current.agreement.snapshotRevision,
        lastUpdatedBy: current.agreement.intakeCompleted ? activeRole : current.agreement.lastUpdatedBy,
      },
    }))
  }

  function moveStep(offset: number) {
    if (state.finalized) return
    const nextIndex = Math.max(0, Math.min(workflowSteps.length - 1, activeIndex + offset))
    mutateActiveDocument((current) => ({
      ...current,
      furthestStepIndex: Math.max(current.furthestStepIndex, nextIndex),
      agreement: {
        ...current.agreement,
        workflowStep: workflowSteps[nextIndex].id,
        snapshotRevision: current.agreement.intakeCompleted
          ? current.agreement.snapshotRevision + 1
          : current.agreement.snapshotRevision,
        lastUpdatedBy: current.agreement.intakeCompleted ? activeRole : current.agreement.lastUpdatedBy,
      },
    }))
  }

  function beginRentWorkflow(intentText: string) {
    mutateActiveDocument((current) => ({
      ...current,
      furthestStepIndex: Math.max(current.furthestStepIndex, 1),
      agreement: { ...current.agreement, intentText, workflowStep: 'details' },
    }))
  }

  function updateProfileName(displayName: string) {
    if (!authSession) return
    persistSession({ ...authSession, displayName })
    if (state.finalized || !activeRole) return

    mutateActiveDocument((current) => {
      const field = activeRole === 'landlord' ? 'landlordName' : 'tenantName'
      return {
        ...current,
        intakeDraft: { ...current.intakeDraft, [field]: displayName },
        agreement: current.agreement.intakeCompleted
          ? {
              ...current.agreement,
              [activeRole]: { ...current.agreement[activeRole], name: displayName },
              snapshotRevision: current.agreement.snapshotRevision + 1,
              lastUpdatedBy: activeRole,
            }
          : current.agreement,
      }
    })
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

    mutateActiveDocument((current) => ({
      ...current,
      intakeDraft: adjusted,
      localRole: nextRole || current.localRole,
    }))

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
    mutateActiveDocument((current) => ({
      ...current,
      intakeDraft: nextDraft,
      localRole: role,
      furthestStepIndex: Math.max(current.furthestStepIndex, 2),
      agreement: {
        ...completed,
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: role,
      },
    }))
    if (authSession) persistSession(bindRole(authSession, state.agreementId, role))
  }

  function finalizeDocument() {
    if (!activeRole || !state.intakeCompleted || state.finalized) return
    const finalizedIndex = workflowStepOrder.indexOf('finalized')
    mutateActiveDocument((current) => ({
      ...current,
      furthestStepIndex: Math.max(current.furthestStepIndex, finalizedIndex),
      agreement: {
        ...current.agreement,
        workflowStep: 'finalized',
        finalized: true,
        finalizedBy: activeRole,
        finalizedAt: new Date().toISOString(),
        [activeRole]: { ...current.agreement[activeRole], approvedAgreement: true },
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: activeRole,
      },
    }))
    setNotice(`Document finalized by the ${activeRole}.`)
  }

  function openShare() {
    const storedWorkspace = loadWorkspace()
    const storedDocument = storedWorkspace.documents[state.agreementId]
    if (!storedDocument?.agreement.finalized) {
      setNotice('Finalize the document before sharing it.')
      return
    }
    setShareSource(storedDocument)
  }

  if (authSession === undefined) {
    return <PageContainer><div className="bootstrap-loading" role="status">Opening your local workspace…</div></PageContainer>
  }

  return (
    <PageContainer>
      <div
        className={authSession ? 'app-frame' : 'app-frame app-frame-locked'}
        aria-hidden={authSession && !shareSource ? undefined : true}
        inert={authSession && !shareSource ? undefined : true}
      >
        <header className="site-header">
          <button type="button" className="brand" onClick={resetWorkflow} aria-label="Build India home">
            <span className="brand-mark" aria-hidden="true">BI</span>
            <span><strong>Build India</strong><small>Legal journeys, simplified</small></span>
          </button>
          <nav className="header-actions" aria-label="Demo controls">
            <Badge tone="accent">Hackathon demo</Badge>
            {authSession ? (
              <select className="document-select" aria-label="Active document" value={workspace.activeDocumentId} onChange={(event) => selectDocument(event.target.value)}>
                {Object.values(workspace.documents).map((item) => <option key={item.agreement.agreementId} value={item.agreement.agreementId}>{documentLabel(item)}</option>)}
              </select>
            ) : null}
            {authSession ? <Button variant="ghost" onClick={createDocument}>New document</Button> : null}
            {authSession && activeRole ? <Badge tone="success">You’re the {activeRole}</Badge> : null}
            {state.finalized && authSession && activeRole ? <Button variant="ghost" onClick={openShare}>Share</Button> : null}
            <Button variant="ghost" onClick={resetWorkflow}>Reset Demo</Button>
            {authSession ? <ProfileMenu name={authSession.displayName} onSave={updateProfileName} /> : null}
            {authSession ? <Button variant="secondary" onClick={() => void logout()}>Logout</Button> : null}
          </nav>
        </header>

        {notice ? <div className="app-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div> : null}

        {state.finalized ? (
          <FinalizedView agreement={state} localRole={activeRole} />
        ) : state.workflowStep === 'intent' ? (
          <IntentScreen initialValue={state.intentText} onContinue={beginRentWorkflow} />
        ) : state.workflowStep === 'details' ? (
          <DetailsScreen draft={draft} onDraftChange={updateDraft} onBack={() => updateWorkflowStep('intent')} onSubmit={submitDetails} />
        ) : (
          <div className="journey-layout">
            <aside className="sidebar">
              <Card>
                <div className="section-heading"><p className="eyebrow">Journey</p><h2>Steps</h2></div>
                <Stepper steps={workflowSteps} activeStepId={state.workflowStep} onSelectStep={updateWorkflowStep} maxSelectableIndex={furthestStepIndex} />
              </Card>
            </aside>

            <main className="content" id="main-content">
              <Card className="stage-card">
                <div className="section-heading"><p className="eyebrow">{activeStep.kicker}</p><h1>{activeStep.title}</h1></div>
                <p className="stage-description">{activeStep.description}</p>
                <div className="transaction-summary">
                  <span><small>Transaction</small><strong>{state.durationMonths}-month residential tenancy</strong></span>
                  <span><small>Location</small><strong>{state.property.city}, {state.property.state}</strong></span>
                  <span><small>Snapshot</small><strong>Revision {state.snapshotRevision}</strong></span>
                </div>
                <div className="placeholder-panel">
                  <p className="placeholder-title">Coming in the next milestone</p>
                  <ul className="placeholder-list">{activeStep.placeholderPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                </div>
              </Card>
              <div className="journey-actions">
                <Button variant="ghost" onClick={() => moveStep(-1)}>Back</Button>
                {state.workflowStep === 'review' ? <Button onClick={finalizeDocument}>Finalize document</Button> : <Button onClick={() => moveStep(1)}>Continue</Button>}
              </div>
            </main>
          </div>
        )}
      </div>

      {!authSession ? (
        <AuthGate
          onAuthenticated={authenticate}
          suggestedDisplayName={roleName(initialShare?.ok ? initialShare.snapshot : null) ?? (activeRole ? storedRoleName(document, activeRole) : undefined)}
        />
      ) : null}

      {shareSource && authSession && activeRole ? (
        <ShareDialog agreement={shareSource.agreement} furthestStepIndex={shareSource.furthestStepIndex} activeRole={activeRole} onClose={() => setShareSource(null)} />
      ) : null}
    </PageContainer>
  )
}

export default App
