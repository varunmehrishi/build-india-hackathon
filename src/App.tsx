import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { generateAgreement, resolveAgreementBuilderConfiguration } from './domain/agreementBuilder'
import { applyIntakeDraft, suggestDocumentName } from './domain/intake'
import {
  areBothPartiesVerified,
  clearExecutionVerification,
  verifyPartyForExecution,
} from './domain/identityVerification'
import { attestAgreement, isNotarizationResolved, skipNotarization } from './domain/notarization'
import { finalizeReviewedAgreement, resolveReviewState } from './domain/review'
import { replaceSnapshotUrl, snapshotFromLocation, type WorkflowSnapshotEnvelope } from './domain/snapshot'
import {
  areAllSignaturesComplete,
  hasAnySignature,
  prepareAgreementForSigning,
  recordSignature,
  recordSignatureCancellation,
} from './domain/signing'
import { configureStampDutyPayment, isStampDutyComplete, recordStampDutyPayment } from './domain/stampDuty'
import type { AgreementBuilderConfiguration, AgreementState, IntakeDraft, WorkflowStep } from './domain/types'
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
import { AgreementBuilder } from './features/agreement/AgreementBuilder'
import { ProfileMenu } from './features/auth/ProfileMenu'
import { FinalizedView } from './features/finalized/FinalizedView'
import { DetailsScreen } from './features/intake/DetailsScreen'
import { IntentScreen } from './features/intake/IntentScreen'
import { IdentityVerificationScreen } from './features/identity/IdentityVerificationScreen'
import { NotarizationScreen } from './features/notary/NotarizationScreen'
import { RequirementsScreen } from './features/requirements/RequirementsScreen'
import { AgreementReview } from './features/review/AgreementReview'
import { ShareDialog } from './features/sharing/ShareDialog'
import { StampDutyScreen } from './features/stamp/StampDutyScreen'
import { ESignScreen } from './features/signing/ESignScreen'

type AuthState = DemoAuthSession | null | undefined
const finalizedStepIndex = workflowStepOrder.indexOf('finalized')
const stampStepIndex = workflowStepOrder.indexOf('stamp')
const identityStepIndex = workflowStepOrder.indexOf('identity')
const notaryStepIndex = workflowStepOrder.indexOf('notary')
const signStepIndex = workflowStepOrder.indexOf('sign')

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

function canBindParticipant(document: StoredDocument, role: 'landlord' | 'tenant', participantId: string): boolean {
  const assignedParticipant = document.agreement[role].participantId
  const otherRole = role === 'landlord' ? 'tenant' : 'landlord'
  return assignedParticipant
    ? assignedParticipant === participantId
    : document.agreement[otherRole].participantId !== participantId
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
  const storedRoleMatchesIdentity = !document.localRole || !authSession ||
    canBindParticipant(document, document.localRole, authSession.participantId)
  const activeRole = (storedRoleMatchesIdentity ? document.localRole : undefined)
    ?? (authSession ? roleForAgreement(authSession, state.agreementId) : undefined)
    ?? (!state.intakeCompleted ? (draft.initiator || undefined) : undefined)
  const identityViewingRole = state.identityVerificationRole
    ?? state.review?.currentRole
    ?? activeRole
    ?? state.initiator
  const signingRole = state.signingRole ?? state.identityVerificationRole ?? state.initiator

  useEffect(() => {
    let cancelled = false
    void restoreAuthSession().then((restored) => {
      if (cancelled) return
      let nextWorkspace = workspace
      if (initialShare?.ok) {
        nextWorkspace = importSnapshot(workspace, initialShare.snapshot)
        saveWorkspace(nextWorkspace)
        setWorkspace(nextWorkspace)
        setNotice('Shared agreement imported into this browser.')
      }
      if (initialShare) replaceSnapshotUrl(null)

      if (restored) {
        const current = activeDocument(nextWorkspace)
        if (current.localRole) {
          const role = current.localRole
          const participantId = current.agreement[role].participantId
          if (canBindParticipant(current, role, restored.participantId)) {
            restored = bindRole(restored, current.agreement.agreementId, role)
            if (!participantId) {
              nextWorkspace = updateDocument(nextWorkspace, current.agreement.agreementId, (stored) => ({
                ...stored,
                agreement: {
                  ...stored.agreement,
                  [role]: { ...stored.agreement[role], participantId: restored?.participantId },
                },
              }))
              saveWorkspace(nextWorkspace)
              setWorkspace(nextWorkspace)
            }
            saveAuthSession(restored)
          }
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
      if (canBindParticipant(selected, selected.localRole, authSession.participantId)) {
        persistSession(bindRole(authSession, agreementId, selected.localRole))
      }
    }
    setNotice('')
    setShareSource(null)
  }

  function authenticate(session: DemoAuthSession) {
    let nextSession = session
    if (document.localRole) {
      const role = document.localRole
      const participantId = state[role].participantId
      if (canBindParticipant(document, role, session.participantId)) {
        nextSession = bindRole(session, state.agreementId, role)
        if (!participantId) {
          mutateActiveDocument((current) => ({
            ...current,
            agreement: {
              ...current.agreement,
              [role]: { ...current.agreement[role], participantId: session.participantId },
            },
          }))
        }
      } else {
        setNotice(`This ${role} role is already linked to the other demo identity.`)
      }
    }
    persistSession(nextSession)
  }

  async function logout() {
    await clearAuthSession()
    setShareSource(null)
    setAuthSession(null)
  }

  function updateWorkflowStep(step: WorkflowStep) {
    const nextIndex = workflowStepOrder.indexOf(step)
    if (nextIndex > furthestStepIndex) return
    if (state.finalized && nextIndex < finalizedStepIndex) return
    if (state.finalized && !state.stampCompleted && nextIndex > stampStepIndex) return
    if (nextIndex > identityStepIndex && !areBothPartiesVerified(state)) return
    if (nextIndex > notaryStepIndex && !isNotarizationResolved(state)) return
    if (nextIndex > signStepIndex && !areAllSignaturesComplete(state)) return
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
    if (offset > 0 && state.workflowStep === 'identity' && !areBothPartiesVerified(state)) return
    if (offset > 0 && state.workflowStep === 'notary' && !isNotarizationResolved(state)) return
    if (offset > 0 && state.workflowStep === 'sign' && !areAllSignaturesComplete(state)) return
    const minimumIndex = state.finalized ? finalizedStepIndex : 0
    const nextIndex = Math.max(minimumIndex, Math.min(workflowSteps.length - 1, activeIndex + offset))
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
      const nextDraft = { ...current.intakeDraft, [field]: displayName }
      if (!current.documentNameCustomized) {
        nextDraft.documentName = suggestDocumentName(nextDraft.landlordName, nextDraft.tenantName)
      }
      return {
        ...current,
        intakeDraft: nextDraft,
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
    const partyNamesChanged =
      nextDraft.landlordName !== draft.landlordName || nextDraft.tenantName !== draft.tenantName
    const documentNameChanged = nextDraft.documentName !== draft.documentName
    const documentNameCustomized = document.documentNameCustomized || (documentNameChanged && !partyNamesChanged)

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

    if (!documentNameCustomized) {
      adjusted.documentName = suggestDocumentName(adjusted.landlordName, adjusted.tenantName)
    }

    mutateActiveDocument((current) => ({
      ...current,
      intakeDraft: adjusted,
      documentNameCustomized,
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
        [role]: { ...completed[role], participantId: authSession?.participantId },
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: role,
      },
    }))
    if (authSession) persistSession(bindRole(authSession, state.agreementId, role))
  }

  function updateAgreementBuilder(configuration: AgreementBuilderConfiguration) {
    if (state.finalized || hasAnySignature(state)) {
      setNotice('This agreement has entered execution and can no longer be edited.')
      return
    }
    mutateActiveDocument((current) => {
      const returningFromReview = Boolean(current.agreement.review)
      return {
        ...current,
        agreement: {
          ...current.agreement,
          agreementBuilder: configuration,
          clauses: generateAgreement(current.agreement, configuration).clauses,
          review: returningFromReview ? undefined : current.agreement.review,
          agreementVersion: returningFromReview
            ? current.agreement.agreementVersion + 1
            : current.agreement.agreementVersion,
          landlord: returningFromReview
            ? { ...clearExecutionVerification(current.agreement.landlord), approvedAgreement: false }
            : current.agreement.landlord,
          tenant: returningFromReview
            ? { ...clearExecutionVerification(current.agreement.tenant), approvedAgreement: false }
            : current.agreement.tenant,
          notarizationStatus: returningFromReview ? 'not_started' : current.agreement.notarizationStatus,
          notarized: returningFromReview ? false : current.agreement.notarized,
          notaryDisplayName: returningFromReview ? undefined : current.agreement.notaryDisplayName,
          notaryRegistrationId: returningFromReview ? undefined : current.agreement.notaryRegistrationId,
          notarizationCompletedAt: returningFromReview ? undefined : current.agreement.notarizationCompletedAt,
          notarizedAgreementVersion: returningFromReview ? undefined : current.agreement.notarizedAgreementVersion,
          snapshotRevision: current.agreement.snapshotRevision + 1,
          lastUpdatedBy: activeRole,
        },
      }
    })
  }

  function continueFromAgreement() {
    mutateActiveDocument((current) => {
      const configuration = resolveAgreementBuilderConfiguration(current.agreement)
      const clauses = generateAgreement(current.agreement, configuration).clauses
      const reviewIndex = workflowStepOrder.indexOf('review')
      return {
        ...current,
        furthestStepIndex: Math.max(current.furthestStepIndex, reviewIndex),
        agreement: {
          ...current.agreement,
          agreementBuilder: configuration,
          clauses,
          review: current.agreement.review ?? resolveReviewState({ ...current.agreement, clauses }),
          workflowStep: 'review',
          snapshotRevision: current.agreement.snapshotRevision + 1,
          lastUpdatedBy: activeRole,
        },
      }
    })
  }

  function updateAgreementReview(nextAgreement: AgreementState) {
    if (state.finalized || hasAnySignature(state)) {
      setNotice('This agreement has entered execution and can no longer be changed.')
      return
    }
    mutateActiveDocument((current) => ({
      ...current,
      agreement: {
        ...nextAgreement,
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: nextAgreement.review?.currentRole ?? activeRole,
      },
    }))
  }

  function finalizeDocument() {
    mutateActiveDocument((current) => {
      const finalized = finalizeReviewedAgreement(current.agreement)
      if (!finalized.finalized) return current
      return {
        ...current,
        furthestStepIndex: Math.max(current.furthestStepIndex, finalizedStepIndex),
        agreement: {
          ...finalized,
          snapshotRevision: current.agreement.snapshotRevision + 1,
          lastUpdatedBy: finalized.review?.currentRole ?? activeRole,
        },
      }
    })
    setNotice('Both parties approved the final agreement. It is locked for execution.')
  }

  function configureStampDuty(landlordPercentage: number) {
    if (!activeRole || state.workflowStep !== 'stamp') return
    try {
      mutateActiveDocument((current) => ({
        ...current,
        agreement: {
          ...current.agreement,
          stampDutyPayment: configureStampDutyPayment(current.agreement, landlordPercentage, activeRole),
          stampCompleted: false,
          snapshotRevision: current.agreement.snapshotRevision + 1,
          lastUpdatedBy: activeRole,
        },
      }))
      setNotice(`Payment split updated by the ${activeRole}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The payment split could not be updated.')
    }
  }

  async function payStampDuty() {
    if (!activeRole || state.workflowStep !== 'stamp') throw new Error('No party role is assigned.')
    let completed = false
    mutateActiveDocument((current) => {
      const stampDutyPayment = recordStampDutyPayment(current.agreement, activeRole)
      completed = isStampDutyComplete(stampDutyPayment)
      return {
        ...current,
        agreement: {
          ...current.agreement,
          stampDutyPayment,
          stampCompleted: completed,
          snapshotRevision: current.agreement.snapshotRevision + 1,
          lastUpdatedBy: activeRole,
        },
      }
    })
    setNotice(completed
      ? 'Stamp duty completed. You can continue to Identity.'
      : `Your contribution is complete. Share the document with the ${activeRole === 'landlord' ? 'tenant' : 'landlord'} to continue.`)
  }

  function updateIdentityViewingRole(role: 'landlord' | 'tenant') {
    mutateActiveDocument((current) => ({
      ...current,
      agreement: {
        ...current.agreement,
        identityVerificationRole: role,
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: role,
      },
    }))
  }

  function verifyIdentity(role: 'landlord' | 'tenant') {
    if (role !== identityViewingRole || state.workflowStep !== 'identity') return
    mutateActiveDocument((current) => ({
      ...current,
      agreement: {
        ...verifyPartyForExecution(current.agreement, role),
        identityVerificationRole: role,
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: role,
      },
    }))
    setNotice(`${state[role].name} is verified for Agreement Version ${state.agreementVersion}.`)
  }

  function continueFromNotary(nextAgreement: AgreementState, message: string) {
    mutateActiveDocument((current) => ({
      ...current,
      furthestStepIndex: Math.max(current.furthestStepIndex, signStepIndex),
      agreement: {
        ...nextAgreement,
        workflowStep: 'sign',
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: activeRole,
      },
    }))
    setNotice(message)
  }

  function skipNotary() {
    if (state.workflowStep !== 'notary') return
    const skipped = skipNotarization(state)
    if (skipped === state) return
    continueFromNotary(skipped, 'Notarisation skipped. You can continue with eSign.')
  }

  function completeNotaryAttestation() {
    if (state.workflowStep !== 'notary') return
    const completed = attestAgreement(state)
    if (completed === state) {
      setNotice('Both parties must be verified before attestation.')
      return
    }
    mutateActiveDocument((current) => ({
      ...current,
      agreement: {
        ...completed,
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: activeRole,
      },
    }))
    setNotice('Notarial attestation completed for this agreement version.')
  }

  function continueToSign() {
    if (state.workflowStep !== 'notary' || !isNotarizationResolved(state)) return
    continueFromNotary(state, 'Notarisation checkpoint complete. Continue with eSign.')
  }

  const prepareSigning = useCallback(async () => {
    const prepared = await prepareAgreementForSigning(state)
    if (!prepared.finalDocumentHash || state.finalDocumentHash) return
    mutateActiveDocument((current) => {
      if (current.agreement.finalDocumentHash || current.agreement.agreementVersion !== prepared.agreementVersion) return current
      return {
        ...current,
        agreement: {
          ...prepared,
          snapshotRevision: current.agreement.snapshotRevision + 1,
          lastUpdatedBy: signingRole,
        },
      }
    })
  // Mutations intentionally use the active agreement captured for this signing screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, signingRole])

  function updateSigningRole(role: 'landlord' | 'tenant') {
    if (state.workflowStep !== 'sign') return
    mutateActiveDocument((current) => ({
      ...current,
      agreement: {
        ...current.agreement,
        signingRole: role,
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: role,
      },
    }))
  }

  async function signAgreement(role: 'landlord' | 'tenant'): Promise<boolean> {
    if (state.workflowStep !== 'sign' || role !== signingRole) return false
    const signed = await recordSignature(state, role)
    const signatureField = role === 'landlord' ? 'landlordSignature' : 'tenantSignature'
    if (!signed[signatureField] || signed[signatureField] === state[signatureField]) return false
    mutateActiveDocument((current) => ({
      ...current,
      agreement: {
        ...signed,
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: role,
      },
    }))
    setNotice(`${state[role].name} signed Version ${state.agreementVersion}.`)
    return true
  }

  function cancelSigning(role: 'landlord' | 'tenant') {
    if (state.workflowStep !== 'sign' || role !== signingRole) return
    mutateActiveDocument((current) => ({
      ...current,
      agreement: {
        ...recordSignatureCancellation(current.agreement, role),
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: role,
      },
    }))
  }

  function continueFromSigning() {
    if (state.workflowStep !== 'sign' || !areAllSignaturesComplete(state)) return
    mutateActiveDocument((current) => ({
      ...current,
      furthestStepIndex: Math.max(current.furthestStepIndex, workflowStepOrder.indexOf('complete')),
      agreement: {
        ...current.agreement,
        workflowStep: 'complete',
        snapshotRevision: current.agreement.snapshotRevision + 1,
        lastUpdatedBy: current.agreement.signingRole ?? activeRole,
      },
    }))
    setNotice('Both parties signed the same final agreement.')
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
          <button type="button" className="brand" onClick={resetWorkflow} aria-label="Saral Setu home">
            <img className="brand-logo" src={`${import.meta.env.BASE_URL}saral-setu-logo.png`} alt="" />
            <span><strong>Saral Setu</strong><small>Legal journeys, simplified</small></span>
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

        {!state.finalized && state.workflowStep === 'intent' ? (
          <IntentScreen initialValue={state.intentText} onContinue={beginRentWorkflow} />
        ) : !state.finalized && state.workflowStep === 'details' ? (
          <DetailsScreen draft={draft} onDraftChange={updateDraft} onBack={() => updateWorkflowStep('intent')} onSubmit={submitDetails} />
        ) : (
          <div className="journey-layout">
            <aside className="sidebar">
              <Card>
                <div className="section-heading"><p className="eyebrow">Journey</p><h2>Steps</h2></div>
                <Stepper
                  steps={workflowSteps}
                  activeStepId={state.workflowStep}
                  onSelectStep={updateWorkflowStep}
                  maxSelectableIndex={state.finalized && !state.stampCompleted
                    ? Math.min(furthestStepIndex, stampStepIndex)
                    : furthestStepIndex}
                  minSelectableIndex={state.finalized ? finalizedStepIndex : undefined}
                />
              </Card>
            </aside>

            <main className="content" id="main-content">
              {state.workflowStep === 'finalized' ? (
                <FinalizedView agreement={state} localRole={activeRole} />
              ) : state.workflowStep === 'stamp' ? (
                <StampDutyScreen
                  agreement={state}
                  documentName={documentLabel(document)}
                  activeRole={activeRole}
                  onConfigure={configureStampDuty}
                  onPay={payStampDuty}
                />
              ) : state.workflowStep === 'identity' ? (
                <IdentityVerificationScreen
                  agreement={state}
                  viewingRole={identityViewingRole}
                  onViewingRoleChange={updateIdentityViewingRole}
                  onVerify={verifyIdentity}
                />
              ) : state.workflowStep === 'notary' ? (
                <NotarizationScreen
                  agreement={state}
                  onSkip={skipNotary}
                  onAttest={completeNotaryAttestation}
                  onContinue={continueToSign}
                />
              ) : state.workflowStep === 'sign' ? (
                <ESignScreen
                  key={signingRole}
                  agreement={state}
                  signingRole={signingRole}
                  onPrepare={prepareSigning}
                  onRoleChange={updateSigningRole}
                  onSign={signAgreement}
                  onCancel={cancelSigning}
                  onContinue={continueFromSigning}
                />
              ) : state.workflowStep === 'requirements' ? (
                <RequirementsScreen agreement={state} />
              ) : state.workflowStep === 'agreement' ? (
                <AgreementBuilder agreement={state} onChange={updateAgreementBuilder} />
              ) : state.workflowStep === 'review' ? (
                <AgreementReview agreement={state} onChange={updateAgreementReview} onFinalize={finalizeDocument} />
              ) : (
                <Card className="stage-card">
                  <div className="section-heading"><p className="eyebrow">{activeStep.kicker}</p><h1>{activeStep.title}</h1></div>
                  <p className="stage-description">{activeStep.description}</p>
                  <div className="transaction-summary">
                    <span><small>Transaction</small><strong>{state.durationMonths}-month residential tenancy</strong></span>
                    <span><small>Location</small><strong>{state.property.city}, {state.property.state}</strong></span>
                  </div>
                  <div className="placeholder-panel">
                    <p className="placeholder-title">Coming in the next milestone</p>
                    <ul className="placeholder-list">{activeStep.placeholderPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                  </div>
                </Card>
              )}
              {state.workflowStep === 'notary' || state.workflowStep === 'sign' ? null : <div className="journey-actions">
                <Button variant="ghost" onClick={() => moveStep(-1)} disabled={state.workflowStep === 'finalized'}>Back</Button>
                {state.workflowStep === 'review' ? null : state.workflowStep === 'agreement' ? (
                  <Button onClick={continueFromAgreement}>Continue to Review</Button>
                ) : (
                  <Button
                    onClick={() => moveStep(1)}
                    disabled={
                      state.workflowStep === 'complete' ||
                      (state.workflowStep === 'stamp' && !state.stampCompleted) ||
                      (state.workflowStep === 'identity' && !areBothPartiesVerified(state))
                    }
                  >{state.workflowStep === 'requirements' ? 'Create Agreement' : 'Continue'}</Button>
                )}
              </div>}
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
        <ShareDialog
          agreement={shareSource.agreement}
          furthestStepIndex={shareSource.furthestStepIndex}
          activeRole={activeRole}
          documentName={shareSource.intakeDraft.documentName}
          documentNameCustomized={shareSource.documentNameCustomized}
          onClose={() => setShareSource(null)}
        />
      ) : null}
    </PageContainer>
  )
}

export default App
