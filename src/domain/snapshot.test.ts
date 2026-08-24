import { describe, expect, it } from 'vitest'
import { zlibSync } from 'fflate'
import { createInitialAgreementState } from './demoData'
import { applyIntakeDraft, demoIntakeDraft } from './intake'
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
