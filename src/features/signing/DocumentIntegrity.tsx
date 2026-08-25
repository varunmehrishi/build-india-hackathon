import { useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { isDocumentUnchanged, signatureMatchesFinalAgreement } from '../../domain/signing'
import type { AgreementState } from '../../domain/types'

interface DocumentIntegrityProps {
  agreement: AgreementState
  open?: boolean
}

export function DocumentIntegrity({ agreement, open = false }: DocumentIntegrityProps) {
  const [unchanged, setUnchanged] = useState<boolean | null>(null)

  useEffect(() => {
    let current = true
    void isDocumentUnchanged(agreement).then((result) => { if (current) setUnchanged(result) })
    return () => { current = false }
  }, [agreement])

  return (
    <details className="esign-details" open={open}>
      <summary>Document integrity</summary>
      <div className="esign-integrity-grid">
        <span><small>Final agreement</small><strong>Version {agreement.review?.finalizedVersion ?? agreement.agreementVersion}</strong></span>
        <span><small>Document ID</small><strong>{agreement.documentId ?? 'Preparing…'}</strong></span>
        <span><small>Tenant</small><strong>{signatureMatchesFinalAgreement(agreement, agreement.tenantSignature) ? 'Signed this version ✓' : 'Awaiting signature'}</strong></span>
        <span><small>Landlord</small><strong>{signatureMatchesFinalAgreement(agreement, agreement.landlordSignature) ? 'Signed this version ✓' : 'Awaiting signature'}</strong></span>
      </div>
      <div className="esign-integrity-result" role="status">
        <Badge tone={unchanged ? 'success' : unchanged === false ? 'neutral' : 'accent'}>
          {unchanged ? 'Document unchanged ✓' : unchanged === false ? 'Document changed' : 'Checking document…'}
        </Badge>
      </div>
    </details>
  )
}
