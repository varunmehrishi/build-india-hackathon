import { describe, expect, it } from 'vitest'
import {
  buildAuditTrail,
  buildExecutionRecordLines,
  buildSignedAgreementLines,
  deriveCompletionSummary,
} from './completion'
import { createInitialAgreementState } from './demoData'
import { verifyPartyForExecution } from './identityVerification'
import { skipNotarization } from './notarization'
import { createTextPdf } from './pdf'
import { prepareAgreementForSigning, recordSignature } from './signing'
import { createStampDutyPayment } from './stampDuty'
import type { AgreementState } from './types'

async function completedAgreement(): Promise<AgreementState> {
  const initial = createInitialAgreementState()
  let agreement: AgreementState = {
    ...initial,
    workflowStep: 'sign',
    agreementVersion: 2,
    finalized: true,
    finalizedAt: '2026-08-26T16:00:00.000Z',
    property: { ...initial.property, address: '24A Lotus Heights', city: 'Bengaluru', state: 'Karnataka' },
    landlord: { ...initial.landlord, name: 'Arjun Rao', approvedAgreement: true },
    tenant: { ...initial.tenant, name: 'Meera Sharma', approvedAgreement: true },
    stampDutyPayment: createStampDutyPayment(0),
    stampCompleted: true,
    requirements: { ...initial.requirements, stampDutyAmount: 0 },
  }
  agreement = verifyPartyForExecution(agreement, 'landlord', { participantId: 'arjun', aadhaarLast4: '6666' }, '2026-08-26T16:02:00.000Z')
  agreement = verifyPartyForExecution(agreement, 'tenant', { participantId: 'meera', aadhaarLast4: '3333' }, '2026-08-26T16:03:00.000Z')
  agreement = skipNotarization(agreement)
  agreement = await prepareAgreementForSigning(agreement, '2026-08-26T16:04:00.000Z')
  agreement = await recordSignature(agreement, 'tenant', '2026-08-26T16:05:00.000Z')
  return recordSignature(agreement, 'landlord', '2026-08-26T16:06:00.000Z')
}

describe('completion domain', () => {
  it('derives completion from version-bound signatures and execution prerequisites', async () => {
    const agreement = await completedAgreement()
    expect(deriveCompletionSummary(agreement)).toMatchObject({
      complete: true,
      finalizedVersion: 2,
      completedAt: '2026-08-26T16:06:00.000Z',
      landlordSigned: true,
      tenantSigned: true,
      stampCompleted: true,
      identitiesVerified: true,
      notarizationStatus: 'skipped',
    })

    expect(deriveCompletionSummary({
      ...agreement,
      landlordSignature: { ...agreement.landlordSignature!, signedVersion: 3 },
    }).complete).toBe(false)
  })

  it('builds final-agreement and execution-record content from current evidence', async () => {
    const agreement = await completedAgreement()
    const signedDocument = buildSignedAgreementLines(agreement).join('\n')
    const executionRecord = buildExecutionRecordLines(agreement, true).join('\n')

    expect(signedDocument).toContain('FINAL SIGNED AGREEMENT')
    expect(signedDocument).toContain(agreement.documentId)
    expect(signedDocument).toContain('DEMO E-STAMP RECORD')
    expect(signedDocument).toContain(agreement.tenantSignature?.signatureReference)
    expect(executionRecord).toContain('SARAL SETU EXECUTION RECORD')
    expect(executionRecord).toContain(agreement.finalDocumentHash)
    expect(executionRecord).toContain('Meera Sharma signed Version 2')
    expect(executionRecord).toContain('Current document matches signed copy: yes')
  })

  it('merges timestamped execution evidence into one ordered audit trail', async () => {
    const agreement = await completedAgreement()
    const events = buildAuditTrail(agreement)
    expect(events.map((event) => event.message)).toEqual(expect.arrayContaining([
      "Arjun Rao's identity was verified for Version 2",
      "Meera Sharma's identity was verified for Version 2",
      'Meera Sharma signed Version 2',
      'Arjun Rao signed Version 2',
      'All required signatures completed',
    ]))
    expect(events.map((event) => event.timestamp)).toEqual([...events.map((event) => event.timestamp)].sort())
  })

  it('creates a downloadable PDF payload without an added PDF dependency', () => {
    const pdf = createTextPdf(['SARAL SETU', 'Residential Rent Agreement', 'Document ID: DEMO-0001'])
    expect(pdf.type).toBe('application/pdf')
    expect(pdf.size).toBeGreaterThan(500)
  })
})
