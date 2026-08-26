import { describe, expect, it } from 'vitest'
import { createInitialAgreementState } from './demoData'
import { demoIntakeDraft } from './intake'
import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  createWorkspace,
  importSnapshot,
  loadWorkspace,
  saveWorkspace,
} from './workspace'

describe('local workspace repository', () => {
  it('round-trips multiple documents and incomplete drafts', () => {
    const workspace = createWorkspace()
    const firstId = workspace.activeDocumentId
    workspace.documents[firstId].intakeDraft = { ...demoIntakeDraft, city: 'Mysuru' }
    const second = createInitialAgreementState()
    workspace.documents[second.agreementId] = {
      agreement: second,
      intakeDraft: { ...demoIntakeDraft, city: 'Pune' },
      documentNameCustomized: false,
      furthestStepIndex: 1,
      localRole: 'landlord',
      updatedAt: new Date().toISOString(),
    }
    workspace.activeDocumentId = second.agreementId

    saveWorkspace(workspace)
    const restored = loadWorkspace()
    expect(Object.keys(restored.documents)).toHaveLength(2)
    expect(restored.activeDocumentId).toBe(second.agreementId)
    expect(restored.documents[firstId].intakeDraft.city).toBe('Mysuru')
  })

  it('upserts an imported agreement without removing other documents', () => {
    const workspace = createWorkspace()
    const existingId = workspace.activeDocumentId
    const imported = createInitialAgreementState()
    imported.finalized = true
    imported.snapshotRevision = 4
    imported.tenant.name = 'Meera Sharma'
    imported.landlord.name = 'Arjun Rao'

    const result = importSnapshot(workspace, {
      codecVersion: 1,
      agreement: imported,
      furthestStepIndex: 5,
      invitedRole: 'landlord',
    })

    expect(Object.keys(result.documents)).toHaveLength(2)
    expect(result.documents[existingId]).toBeDefined()
    expect(result.activeDocumentId).toBe(imported.agreementId)
    expect(result.documents[imported.agreementId].localRole).toBe('landlord')
    expect(result.documents[imported.agreementId].agreement.finalizedBy).toBe('tenant')
    expect(result.documents[imported.agreementId].intakeDraft.documentName).toBe('Arjun Rao & Meera Sharma')
  })

  it('deterministically rejects an older revision of the same agreement', () => {
    const workspace = createWorkspace()
    const id = workspace.activeDocumentId
    workspace.documents[id].agreement.snapshotRevision = 8
    workspace.documents[id].agreement.intentText = 'Keep the newer local state'
    const older = { ...workspace.documents[id].agreement, snapshotRevision: 7, intentText: 'Older shared state' }

    const result = importSnapshot(workspace, {
      codecVersion: 1,
      agreement: older,
      furthestStepIndex: workspace.documents[id].furthestStepIndex,
    })

    expect(result).toBe(workspace)
    expect(result.documents[id].agreement.intentText).toBe('Keep the newer local state')
  })

  it('migrates version-one documents with a party-based name', () => {
    const current = createWorkspace()
    const currentDocument = current.documents[current.activeDocumentId]
    currentDocument.intakeDraft = { ...demoIntakeDraft }
    const { documentName: _documentName, ...legacyDraft } = currentDocument.intakeDraft
    const { documentNameCustomized: _customized, ...legacyDocument } = currentDocument
    localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    localStorage.setItem(LEGACY_WORKSPACE_STORAGE_KEY, JSON.stringify({
      version: 1,
      activeDocumentId: current.activeDocumentId,
      documents: {
        [current.activeDocumentId]: { ...legacyDocument, intakeDraft: legacyDraft },
      },
    }))

    const migrated = loadWorkspace()
    expect(migrated.version).toBe(2)
    expect(migrated.documents[migrated.activeDocumentId].intakeDraft.documentName).toBe('Arjun Rao & Meera Sharma')
    expect(migrated.documents[migrated.activeDocumentId].documentNameCustomized).toBe(false)
    expect(localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY)).toBeNull()
  })

  it('replaces malformed storage with a usable workspace', () => {
    localStorage.setItem(LEGACY_WORKSPACE_STORAGE_KEY, '{bad json')
    const workspace = loadWorkspace()
    expect(workspace.documents[workspace.activeDocumentId]).toBeDefined()
  })
})
