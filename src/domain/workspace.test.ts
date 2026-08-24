import { describe, expect, it } from 'vitest'
import { createInitialAgreementState } from './demoData'
import { demoIntakeDraft } from './intake'
import { createWorkspace, importSnapshot, loadWorkspace, saveWorkspace } from './workspace'

describe('local workspace repository', () => {
  it('round-trips multiple documents and incomplete drafts', () => {
    const workspace = createWorkspace()
    const firstId = workspace.activeDocumentId
    workspace.documents[firstId].intakeDraft = { ...demoIntakeDraft, city: 'Mysuru' }
    const second = createInitialAgreementState()
    workspace.documents[second.agreementId] = {
      agreement: second,
      intakeDraft: { ...demoIntakeDraft, city: 'Pune' },
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
  })

  it('replaces malformed storage with a usable workspace', () => {
    localStorage.setItem('build-india-workspace-v1', '{bad json')
    const workspace = loadWorkspace()
    expect(workspace.documents[workspace.activeDocumentId]).toBeDefined()
  })
})
