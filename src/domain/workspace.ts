import { createInitialAgreementState } from './demoData'
import { emptyIntakeDraft, intakeDraftFromAgreement, suggestDocumentName } from './intake'
import { isAgreementState, type WorkflowSnapshotEnvelope } from './snapshot'
import type { AgreementState, IntakeDraft, PartyRole } from './types'

export const WORKSPACE_STORAGE_KEY = 'build-india-workspace-v2'
export const LEGACY_WORKSPACE_STORAGE_KEY = 'build-india-workspace-v1'

export interface StoredDocument {
  agreement: AgreementState
  intakeDraft: IntakeDraft
  documentNameCustomized: boolean
  furthestStepIndex: number
  localRole?: PartyRole
  updatedAt: string
}

export interface LocalWorkspace {
  version: 2
  activeDocumentId: string
  documents: Record<string, StoredDocument>
}

interface LegacyIntakeDraft extends Omit<IntakeDraft, 'documentName'> {}

interface LegacyStoredDocument {
  agreement: AgreementState
  intakeDraft: LegacyIntakeDraft
  furthestStepIndex: number
  localRole?: PartyRole
  updatedAt: string
}

interface LegacyWorkspace {
  version: 1
  activeDocumentId: string
  documents: Record<string, LegacyStoredDocument>
}

function now(): string {
  return new Date().toISOString()
}

function nameFromDocument(document: Pick<StoredDocument, 'agreement' | 'intakeDraft'>): string {
  return suggestDocumentName(
    document.intakeDraft.landlordName || document.agreement.landlord.name,
    document.intakeDraft.tenantName || document.agreement.tenant.name,
  )
}

export function createStoredDocument(agreement = createInitialAgreementState()): StoredDocument {
  const documentName = suggestDocumentName(agreement.landlord.name, agreement.tenant.name)
  return {
    agreement,
    intakeDraft: agreement.intakeCompleted
      ? intakeDraftFromAgreement(agreement, documentName)
      : { ...emptyIntakeDraft },
    documentNameCustomized: false,
    furthestStepIndex: 0,
    updatedAt: now(),
  }
}

export function createWorkspace(): LocalWorkspace {
  const document = createStoredDocument()
  return {
    version: 2,
    activeDocumentId: document.agreement.agreementId,
    documents: { [document.agreement.agreementId]: document },
  }
}

const legacyDraftKeys = [
  'initiator', 'state', 'city', 'address', 'propertyType', 'monthlyRent',
  'securityDeposit', 'durationMonths', 'startDate', 'landlordName', 'tenantName',
] as const

function isLegacyDraft(value: unknown): value is LegacyIntakeDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return legacyDraftKeys.every((key) => typeof draft[key] === 'string')
}

function isDraft(value: unknown): value is IntakeDraft {
  return isLegacyDraft(value) && typeof (value as Record<string, unknown>).documentName === 'string'
}

function hasValidDocumentMetadata(document: Partial<LegacyStoredDocument>): boolean {
  return (
    typeof document.furthestStepIndex === 'number' &&
    Number.isInteger(document.furthestStepIndex) &&
    document.furthestStepIndex >= 0 &&
    document.furthestStepIndex <= 10 &&
    (document.localRole === undefined || document.localRole === 'landlord' || document.localRole === 'tenant') &&
    typeof document.updatedAt === 'string'
  )
}

function isStoredDocument(value: unknown): value is StoredDocument {
  if (!value || typeof value !== 'object') return false
  const document = value as Partial<StoredDocument>
  return (
    isAgreementState(document.agreement) &&
    isDraft(document.intakeDraft) &&
    typeof document.documentNameCustomized === 'boolean' &&
    hasValidDocumentMetadata(document)
  )
}

function isLegacyStoredDocument(value: unknown): value is LegacyStoredDocument {
  if (!value || typeof value !== 'object') return false
  const document = value as Partial<LegacyStoredDocument>
  return isAgreementState(document.agreement) && isLegacyDraft(document.intakeDraft) && hasValidDocumentMetadata(document)
}

function hasValidDocumentCollection<T extends LegacyStoredDocument>(
  workspace: { activeDocumentId?: unknown; documents?: unknown },
  validator: (document: unknown) => document is T,
): workspace is { activeDocumentId: string; documents: Record<string, T> } {
  if (
    typeof workspace.activeDocumentId !== 'string' ||
    !workspace.documents ||
    typeof workspace.documents !== 'object'
  ) return false
  const documents = workspace.documents as Record<string, unknown>
  const entries = Object.entries(documents)
  return (
    entries.length > 0 &&
    entries.every(([id, document]) => validator(document) && document.agreement.agreementId === id) &&
    workspace.activeDocumentId in documents
  )
}

function isWorkspace(value: unknown): value is LocalWorkspace {
  if (!value || typeof value !== 'object') return false
  const workspace = value as Partial<LocalWorkspace>
  return workspace.version === 2 && hasValidDocumentCollection(workspace, isStoredDocument)
}

function isLegacyWorkspace(value: unknown): value is LegacyWorkspace {
  if (!value || typeof value !== 'object') return false
  const workspace = value as Partial<LegacyWorkspace>
  return workspace.version === 1 && hasValidDocumentCollection(workspace, isLegacyStoredDocument)
}

function migrateWorkspace(workspace: LegacyWorkspace): LocalWorkspace {
  return {
    version: 2,
    activeDocumentId: workspace.activeDocumentId,
    documents: Object.fromEntries(Object.entries(workspace.documents).map(([id, document]) => {
      const documentName = suggestDocumentName(
        document.intakeDraft.landlordName || document.agreement.landlord.name,
        document.intakeDraft.tenantName || document.agreement.tenant.name,
      )
      return [id, {
        ...document,
        intakeDraft: { ...document.intakeDraft, documentName },
        documentNameCustomized: false,
      } satisfies StoredDocument]
    })),
  }
}

export function loadWorkspace(): LocalWorkspace {
  try {
    const currentRaw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (currentRaw) {
      const current: unknown = JSON.parse(currentRaw)
      if (isWorkspace(current)) return current
    }

    const legacyRaw = localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)
    if (legacyRaw) {
      const legacy: unknown = JSON.parse(legacyRaw)
      if (isLegacyWorkspace(legacy)) {
        const migrated = migrateWorkspace(legacy)
        saveWorkspace(migrated)
        return migrated
      }
    }
  } catch {
    // Replace malformed storage with a safe empty workspace.
  }
  localStorage.removeItem(WORKSPACE_STORAGE_KEY)
  localStorage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY)
  return createWorkspace()
}

export function saveWorkspace(workspace: LocalWorkspace): void {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace))
  localStorage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY)
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
  const fallbackName = suggestDocumentName(snapshot.agreement.landlord.name, snapshot.agreement.tenant.name)
  const documentName = snapshot.documentName?.trim() || fallbackName
  const document: StoredDocument = {
    agreement: {
      ...snapshot.agreement,
      finalizedBy: snapshot.agreement.finalized
        ? snapshot.agreement.finalizedBy ?? snapshot.agreement.lastUpdatedBy ?? snapshot.agreement.initiator
        : undefined,
    },
    intakeDraft: intakeDraftFromAgreement(snapshot.agreement, documentName),
    documentNameCustomized: snapshot.documentNameCustomized ?? false,
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
  return document.intakeDraft.documentName.trim() || nameFromDocument(document)
}
