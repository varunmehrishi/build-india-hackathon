import { describe, expect, it } from 'vitest'
import { createInitialAgreementState } from './demoData'
import { createDefaultAgreementBuilderConfiguration } from './agreementBuilder'
import {
  areAllSignaturesComplete,
  documentIdFromHash,
  hashAgreement,
  isDocumentUnchanged,
  prepareAgreementForSigning,
  recordSignature,
  recordSignatureCancellation,
  serializeFinalAgreement,
  signatureMatchesFinalAgreement,
} from './signing'
import type { AgreementState } from './types'

function readyAgreement(): AgreementState {
  const agreement = createInitialAgreementState()
  return {
    ...agreement,
    workflowStep: 'sign',
    finalized: true,
    finalizedAt: '2026-08-26T06:00:00.000Z',
    agreementVersion: 2,
    property: { ...agreement.property, address: '24A Lotus Heights', city: 'Bengaluru', state: 'Karnataka' },
    landlord: { ...agreement.landlord, name: 'Arjun Rao', identityVerified: true, identityVerifiedVersion: 2 },
    tenant: { ...agreement.tenant, name: 'Meera Sharma', identityVerified: true, identityVerifiedVersion: 2 },
    stampCompleted: true,
    notarizationStatus: 'skipped',
  }
}

describe('eSign domain', () => {
  it('serializes only stable final document content and creates a real SHA-256 reference', async () => {
    const agreement = readyAgreement()
    const hash = await hashAgreement(agreement)
    const withVolatileState = { ...agreement, workflowStep: 'complete' as const, snapshotRevision: 99, signingRole: 'landlord' as const }

    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(await hashAgreement(withVolatileState)).toBe(hash)
    expect(documentIdFromHash(hash)).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/)
    expect(serializeFinalAgreement(agreement)).not.toContain('snapshotRevision')
  })

  it('hashes effective inventory notes but ignores dormant unfurnished inventory', async () => {
    const configuration = createDefaultAgreementBuilderConfiguration()
    configuration.furnishing.inventory[0].notes = 'Scratch on left door'
    const furnished = { ...readyAgreement(), agreementBuilder: configuration }
    const originalHash = await hashAgreement(furnished)

    const changedNote = {
      ...furnished,
      agreementBuilder: {
        ...configuration,
        furnishing: {
          ...configuration.furnishing,
          inventory: configuration.furnishing.inventory.map((item, index) => index === 0 ? { ...item, notes: 'No scratch' } : item),
        },
      },
    }
    expect(await hashAgreement(changedNote)).not.toBe(originalHash)

    const unfurnished = {
      ...furnished,
      agreementBuilder: { ...configuration, furnishing: { ...configuration.furnishing, level: 'unfurnished' as const } },
    }
    const dormantChange = {
      ...unfurnished,
      agreementBuilder: {
        ...unfurnished.agreementBuilder,
        furnishing: {
          ...unfurnished.agreementBuilder.furnishing,
          inventory: unfurnished.agreementBuilder.furnishing.inventory.map((item) => ({ ...item, notes: 'Dormant change' })),
        },
      },
    }
    expect(await hashAgreement(dormantChange)).toBe(await hashAgreement(unfurnished))
  })

  it('prepares one fingerprint and ties both signatures to the same version and hash', async () => {
    let agreement = await prepareAgreementForSigning(readyAgreement(), '2026-08-26T06:10:00.000Z')
    expect(agreement.finalDocumentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(agreement.signingEvents?.[0].type).toBe('signing-started')

    agreement = await recordSignature(agreement, 'tenant', '2026-08-26T06:12:00.000Z')
    expect(signatureMatchesFinalAgreement(agreement, agreement.tenantSignature)).toBe(true)
    expect(agreement.tenantSignature?.signatureReference).toMatch(/^SIG-DEMO-/)
    expect(agreement.signingStatus).toBe('partially-signed')

    agreement = await recordSignature(agreement, 'landlord', '2026-08-26T06:14:00.000Z')
    expect(agreement.landlordSignature?.signedDocumentHash).toBe(agreement.tenantSignature?.signedDocumentHash)
    expect(agreement.landlordSignature?.signedVersion).toBe(2)
    expect(areAllSignaturesComplete(agreement)).toBe(true)
    expect(agreement.signingStatus).toBe('complete')
    expect(agreement.signingEvents?.at(-1)?.type).toBe('all-signatures-completed')
  })

  it('recomputes integrity and refuses a second signature after substantive content changes', async () => {
    let agreement = await prepareAgreementForSigning(readyAgreement())
    agreement = await recordSignature(agreement, 'tenant')
    const changed = { ...agreement, clauses: agreement.clauses.map((clause, index) => index === 0 ? { ...clause, text: `${clause.text} Changed.` } : clause) }

    expect(await isDocumentUnchanged(changed)).toBe(false)
    const blocked = await recordSignature(changed, 'landlord')
    expect(blocked.landlordSignature).toBeUndefined()
  })

  it('records cancellation without creating a partial signature', async () => {
    const prepared = await prepareAgreementForSigning(readyAgreement())
    const cancelled = recordSignatureCancellation(prepared, 'tenant', '2026-08-26T06:11:00.000Z')

    expect(cancelled.tenantSignature).toBeUndefined()
    expect(cancelled.tenant.signed).toBe(false)
    expect(cancelled.signingEvents?.at(-1)?.type).toBe('signature-cancelled')
  })
})
