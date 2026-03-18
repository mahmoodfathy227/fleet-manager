import { notFound } from 'next/navigation'
import { DriverDetailClient } from './DriverDetailClient'

export default async function DriverDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!id) notFound()
  return <DriverDetailClient id={id} />
}
