import { createInitialAgreementState } from './demoData'
import { emptyIntakeDraft, intakeDraftFromAgreement } from './intake'
import { isAgreementState, type WorkflowSnapshotEnvelope } from './snapshot'
import type { AgreementState, IntakeDraft, PartyRole } from './types'

export const WORKSPACE_STORAGE_KEY = 'build-india-workspace-v1'

export interface StoredDocument {
  agreement: AgreementState
  intakeDraft: IntakeDraft
  furthestStepIndex: number
  localRole?: PartyRole
  updatedAt: string
}

export interface LocalWorkspace {
  version: 1
  activeDocumentId: string
  documents: Record<string, StoredDocument>
}

function now(): string {
  return new Date().toISOString()
}

export function createStoredDocument(agreement = createInitialAgreementState()): StoredDocument {
  return {
    agreement,
    intakeDraft: agreement.intakeCompleted ? intakeDraftFromAgreement(agreement) : { ...emptyIntakeDraft },
    furthestStepIndex: 0,
    updatedAt: now(),
  }
}

export function createWorkspace(): LocalWorkspace {
  const document = createStoredDocument()
  return {
    version: 1,
    activeDocumentId: document.agreement.agreementId,
    documents: { [document.agreement.agreementId]: document },
  }
}

function isDraft(value: unknown): value is IntakeDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return [
    'initiator', 'state', 'city', 'address', 'propertyType', 'monthlyRent',
    'securityDeposit', 'durationMonths', 'startDate', 'landlordName', 'tenantName',
  ].every((key) => typeof draft[key] === 'string')
}

function isStoredDocument(value: unknown): value is StoredDocument {
  if (!value || typeof value !== 'object') return false
  const document = value as Partial<StoredDocument>
  return (
    isAgreementState(document.agreement) &&
    isDraft(document.intakeDraft) &&
    typeof document.furthestStepIndex === 'number' &&
    Number.isInteger(document.furthestStepIndex) &&
    document.furthestStepIndex >= 0 &&
    document.furthestStepIndex <= 10 &&
    (document.localRole === undefined || document.localRole === 'landlord' || document.localRole === 'tenant') &&
    typeof document.updatedAt === 'string'
  )
}

function isWorkspace(value: unknown): value is LocalWorkspace {
  if (!value || typeof value !== 'object') return false
  const workspace = value as Partial<LocalWorkspace>
  if (
    workspace.version !== 1 ||
    typeof workspace.activeDocumentId !== 'string' ||
    !workspace.documents ||
    typeof workspace.documents !== 'object'
  ) return false
  const entries = Object.entries(workspace.documents)
  return (
    entries.length > 0 &&
    entries.every(([id, document]) => isStoredDocument(document) && document.agreement.agreementId === id) &&
    workspace.activeDocumentId in workspace.documents
  )
}

export function loadWorkspace(): LocalWorkspace {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) return createWorkspace()
    const parsed: unknown = JSON.parse(raw)
    if (isWorkspace(parsed)) return parsed
  } catch {
    // Replace malformed or unavailable storage with a safe empty workspace.
  }
  localStorage.removeItem(WORKSPACE_STORAGE_KEY)
  return createWorkspace()
}

export function saveWorkspace(workspace: LocalWorkspace): void {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace))
}

export function activeDocument(workspace: LocalWorkspace): StoredDocument {
  return workspace.documents[workspace.activeDocumentId]
}

export function updateDocument(
  workspace: LocalWorkspace,
  agreementId: string,
  updater: (document: StoredDocument) => StoredDocument,
): LocalWorkspace {
  const current = workspace.documents[agreementId]
  if (!current) return workspace
  const updated = { ...updater(current), updatedAt: now() }
  return { ...workspace, documents: { ...workspace.documents, [agreementId]: updated } }
}

export function addNewDocument(workspace: LocalWorkspace): LocalWorkspace {
  const document = createStoredDocument()
  return {
    ...workspace,
    activeDocumentId: document.agreement.agreementId,
    documents: { ...workspace.documents, [document.agreement.agreementId]: document },
  }
}

export function replaceActiveWithNewDocument(workspace: LocalWorkspace): LocalWorkspace {
  const document = createStoredDocument()
  const documents = { ...workspace.documents }
  delete documents[workspace.activeDocumentId]
  documents[document.agreement.agreementId] = document
  return { ...workspace, activeDocumentId: document.agreement.agreementId, documents }
}

export function importSnapshot(
  workspace: LocalWorkspace,
  snapshot: WorkflowSnapshotEnvelope,
): LocalWorkspace {
  const existing = workspace.documents[snapshot.agreement.agreementId]
  const role = snapshot.invitedRole ?? existing?.localRole
  const document: StoredDocument = {
    agreement: {
      ...snapshot.agreement,
      finalizedBy: snapshot.agreement.finalized
        ? snapshot.agreement.finalizedBy ?? snapshot.agreement.lastUpdatedBy ?? snapshot.agreement.initiator
        : undefined,
    },
    intakeDraft: intakeDraftFromAgreement(snapshot.agreement),
    furthestStepIndex: snapshot.furthestStepIndex,
    localRole: role,
    updatedAt: now(),
  }
  return {
    ...workspace,
    activeDocumentId: snapshot.agreement.agreementId,
    documents: { ...workspace.documents, [snapshot.agreement.agreementId]: document },
  }
}

export function documentLabel(document: StoredDocument): string {
  const { agreement } = document
  if (!agreement.intakeCompleted) return 'Untitled document'
  return `${agreement.tenant.name || 'Tenant'} · ${agreement.property.city || 'Rent agreement'}`
}
