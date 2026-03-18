import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ComplianceCaseDetailClient } from './ComplianceCaseDetailClient'

async function getCase(id: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('compliance_cases')
    .select(`
      id,
      notification_id,
      application_status,
      date_applied,
      appointment_date,
      created_at,
      updated_at,
      notifications (
        id,
        certificate_name,
        entity_type,
        entity_id,
        expiry_date,
        days_until_expiry,
        recipient:recipient_employee_id(full_name)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data
}

async function getCaseUpdates(caseId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('compliance_case_updates')
    .select('id, update_type, notes, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return []
  return data || []
}

export default async function ComplianceCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const caseId = parseInt(id, 10)
  if (Number.isNaN(caseId)) notFound()

  const [caseRow, updates] = await Promise.all([
    getCase(caseId),
    getCaseUpdates(caseId),
  ])

  if (!caseRow) notFound()

  return (
    <ComplianceCaseDetailClient
      caseId={caseId}
      initialCase={caseRow as any}
      initialUpdates={updates}
    />
  )
}
