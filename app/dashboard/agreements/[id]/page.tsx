import { AgreementDetailClient } from './AgreementDetailClient'

export default function AgreementDetailPage({ params }: { params: { id: string } }) {
  return <AgreementDetailClient agreementId={params.id} />
}
