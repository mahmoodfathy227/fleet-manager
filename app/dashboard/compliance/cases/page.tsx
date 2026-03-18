import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { FolderOpen, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'

async function getComplianceCases() {
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
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Error fetching compliance cases:', error)
    return []
  }
  return data || []
}

function getEntityLink(entityType: string, entityId: number) {
  if (entityType === 'vehicle') return `/dashboard/vehicles/${entityId}`
  if (entityType === 'driver' || entityType === 'assistant') return `/dashboard/employees/${entityId}`
  return '#'
}

export default async function ComplianceCasesPage() {
  const cases = await getComplianceCases()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance Cases</h1>
          <p className="text-sm text-slate-500">
            Track application status, date applied, and appointment date. Open a case from the Notifications tab.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Certificate</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Application status</TableHead>
              <TableHead>Date applied</TableHead>
              <TableHead>Appointment date</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <FolderOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No compliance cases yet</p>
                  <p className="text-sm text-slate-400">
                    Open a case from the Notifications tab by clicking &quot;Open case&quot; on a notification
                  </p>
                  <Link href="/dashboard/compliance" className="inline-block mt-3">
                    <Button variant="secondary" size="sm">Go to Notifications</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              cases.map((row: any) => {
                const notif = Array.isArray(row.notifications) ? row.notifications[0] : row.notifications
                const recipient = notif?.recipient
                const rec = Array.isArray(recipient) ? recipient[0] : recipient
                return (
                  <TableRow key={row.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="font-semibold text-slate-800">{notif?.certificate_name || '—'}</div>
                      <div className="text-xs text-slate-500">{notif?.entity_type}</div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={getEntityLink(notif?.entity_type || '', notif?.entity_id || 0)}
                        className="text-primary hover:underline hover:text-primary/80"
                      >
                        View {notif?.entity_type}
                      </Link>
                      {rec?.full_name && (
                        <div className="text-xs text-slate-500">{rec.full_name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={row.application_status === 'applied' ? 'text-emerald-600 font-medium' : 'text-slate-600'}>
                        {row.application_status === 'applied' ? 'Applied' : 'Not applied'}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {row.date_applied ? formatDate(row.date_applied) : '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {row.appointment_date ? formatDate(row.appointment_date) : '—'}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {row.created_at ? formatDate(row.created_at) : '—'}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/compliance/cases/${row.id}`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
