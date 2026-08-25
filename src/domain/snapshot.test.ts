import { describe, expect, it } from 'vitest'
import { zlibSync } from 'fflate'
import { createInitialAgreementState } from './demoData'
import { createDefaultAgreementBuilderConfiguration } from './agreementBuilder'
import { applyIntakeDraft, demoIntakeDraft } from './intake'
import { createProposal, resolveReviewState } from './review'
import { configureStampDutyPayment, recordStampDutyPayment } from './stampDuty'
import {
  MAX_ENCODED_SNAPSHOT_LENGTH,
  createSnapshotUrl,
  decodeSnapshot,
  encodeSnapshot,
  snapshotFromLocation,
  type WorkflowSnapshotEnvelope,
} from './snapshot'

function createSnapshot(invitedRole?: 'landlord' | 'tenant'): WorkflowSnapshotEnvelope {
  const agreement = applyIntakeDraft(createInitialAgreementState(), {
    ...demoIntakeDraft,
    address: '१२, कमल निवास, Bengaluru',
  })
  agreement.snapshotRevision = 3
  agreement.lastUpdatedBy = 'tenant'
  return { codecVersion: 1, agreement, furthestStepIndex: 2, invitedRole }
}

describe('workflow snapshots', () => {
  it('round-trips compressed Unicode agreement state', () => {
    const original: WorkflowSnapshotEnvelope = {
      ...createSnapshot('landlord'),
      documentName: 'कमल निवास lease',
      documentNameCustomized: true,
    }
    original.agreement.agreementBuilder = createDefaultAgreementBuilderConfiguration()
    original.agreement.agreementBuilder.deposit.refundDays = 7
    original.agreement.identityVerificationRole = 'landlord'
    original.agreement.landlord.identityVerified = true
    original.agreement.landlord.identityVerifiedVersion = original.agreement.agreementVersion
    original.agreement.landlord.identityVerifiedAt = '2026-08-26T10:00:00.000Z'
    original.agreement.notarizationStatus = 'completed'
    original.agreement.notarized = true
    original.agreement.notaryDisplayName = 'Adv. A. Sharma'
    original.agreement.notaryRegistrationId = 'DEMO-001'
    original.agreement.notarizationCompletedAt = '2026-08-26T14:44:00.000Z'
    original.agreement.notarizedAgreementVersion = original.agreement.agreementVersion
    original.agreement.finalDocumentHash = 'a'.repeat(64)
    original.agreement.documentId = 'AAAA-AAAA-AAAA'
    original.agreement.signingRole = 'tenant'
    original.agreement.signingStatus = 'partially-signed'
    original.agreement.tenantSignature = {
      signerRole: 'tenant',
      signerName: 'Meera Sharma',
      signedVersion: original.agreement.agreementVersion,
      signedDocumentHash: 'a'.repeat(64),
      signedAt: '2026-08-26T14:48:00.000Z',
      signatureReference: 'SIG-DEMO-A73F',
    }
    original.agreement.signingEvents = [{
      id: 'signature-completed-1',
      type: 'signature-completed',
      actor: 'tenant',
      timestamp: '2026-08-26T14:48:00.000Z',
      message: 'Meera Sharma signed Version 1',
    }]
    original.agreement.clauses = [{
      id: 'security-deposit-refund',
      title: 'Security Deposit',
      text: 'The security deposit will be refunded within 30 days after handover.',
    }]
    original.agreement.review = {
      ...resolveReviewState(original.agreement),
      currentRole: 'tenant',
      selectedClauseId: 'security-deposit-refund',
    }
    original.agreement = createProposal(
      original.agreement,
      'security-deposit-refund',
      'Can we make this 7 days instead?',
      '2026-08-25T10:00:00.000Z',
    )
    const result = decodeSnapshot(encodeSnapshot(original))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.snapshot).toEqual(original)
  })

  it('uses URL-safe encoding and reads the fragment', () => {
    const url = createSnapshotUrl(createSnapshot('tenant'))
    expect(url).toContain('#share=')
    expect(url.split('#share=')[1]).toMatch(/^[A-Za-z0-9_-]+$/)
    window.history.replaceState(null, '', url)
    const result = snapshotFromLocation()
    expect(result?.ok).toBe(true)
  })

  it('round-trips a partial payment while accepting an older snapshot without payment state', () => {
    const partial = createSnapshot('landlord')
    partial.agreement.stampDutyPayment = configureStampDutyPayment(partial.agreement, 50, 'tenant')
    partial.agreement.stampDutyPayment = recordStampDutyPayment(
      partial.agreement,
      'tenant',
      '2026-08-25T10:00:00.000Z',
      'SS-STAMP-PERSISTED',
    )
    const partialResult = decodeSnapshot(encodeSnapshot(partial))
    expect(partialResult.ok).toBe(true)
    if (partialResult.ok) {
      expect(partialResult.snapshot.agreement.stampDutyPayment?.tenant.paymentReference).toBe('SS-STAMP-PERSISTED')
    }

    const older = createSnapshot('tenant')
    expect(older.agreement.stampDutyPayment).toBeUndefined()
    expect(decodeSnapshot(encodeSnapshot(older)).ok).toBe(true)
  })

  it('rejects malformed, oversized, and unsupported snapshots', () => {
    expect(decodeSnapshot('not-valid!').ok).toBe(false)
    expect(decodeSnapshot('a'.repeat(MAX_ENCODED_SNAPSHOT_LENGTH + 1)).ok).toBe(false)

    const encoded = encodeSnapshot(createSnapshot())
    const result = decodeSnapshot(encoded.slice(0, Math.floor(encoded.length / 2)))
    expect(result.ok).toBe(false)
  })

  it('stops highly compressed input at the decoded-size limit', () => {
    const compressed = zlibSync(new Uint8Array(300 * 1024))
    let binary = ''
    for (const byte of compressed) binary += String.fromCharCode(byte)
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

    expect(decodeSnapshot(encoded).ok).toBe(false)
  })
})
