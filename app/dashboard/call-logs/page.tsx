import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Plus, Eye, Pencil, Phone } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

async function getCallLogs() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('call_logs')
    .select(`
      *,
      passengers(full_name),
      employees(full_name),
      routes(route_number)
    `)
    .order('call_date', { ascending: false })

  if (error) {
    console.error('Error fetching call logs:', error)
    return []
  }

  return data || []
}

async function CallLogsTable() {
  const callLogs = await getCallLogs()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date/Time</TableHead>
            <TableHead>Caller</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Related To</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {callLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12">
                <Phone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No call logs found</p>
                <p className="text-sm text-slate-400">Log your first call to get started</p>
              </TableCell>
            </TableRow>
          ) : (
            callLogs.map((log: any) => (
              <TableRow key={log.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="text-sm">
                    <div className="font-semibold text-slate-800">{formatDateTime(log.call_date)}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-semibold text-slate-800">{log.caller_name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{log.caller_phone || 'No phone'}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-700">
                    {log.call_type || 'N/A'}
                  </span>
                </TableCell>
                <TableCell className="max-w-xs">
                  <div className="truncate font-semibold text-slate-800">{log.subject}</div>
                  {log.notes && (
                    <div className="text-xs text-slate-400 truncate">{log.notes}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-xs space-y-1">
                    {log.passengers && (
                      <div>
                        <span className="text-slate-400">Passenger: </span>
                        <Link href={`/dashboard/passengers/${log.related_passenger_id}`} className="text-primary hover:underline">
                          {log.passengers.full_name}
                        </Link>
                      </div>
                    )}
                    {log.employees && (
                      <div>
                        <span className="text-slate-400">Employee: </span>
                        <span className="font-medium text-slate-700">{log.employees.full_name}</span>
                      </div>
                    )}
                    {log.routes && (
                      <div>
                        <span className="text-slate-400">Route: </span>
                        <span className="font-medium text-slate-700">{log.routes.route_number}</span>
                      </div>
                    )}
                    {!log.passengers && !log.employees && !log.routes && (
                      <span className="text-slate-300">None</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${log.priority === 'Urgent'
                      ? 'bg-rose-100 text-rose-700'
                      : log.priority === 'High'
                        ? 'bg-orange-100 text-orange-700'
                        : log.priority === 'Medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {log.priority || 'Low'}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${log.status === 'Resolved' || log.status === 'Closed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : log.status === 'In Progress'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {log.status || 'Open'}
                  </span>
                  {log.action_required && (
                    <div className="mt-1">
                      <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                        Action Required
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/call-logs/${log.id}`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/call-logs/${log.id}/edit`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default function CallLogsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
            <Phone className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Call Logs</h1>
            <p className="text-sm text-slate-500">Track all phone calls and communications</p>
          </div>
        </div>
        <Link href="/dashboard/call-logs/create" prefetch={true}>
          <Button className="bg-primary hover:bg-primary/90 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Log Call
          </Button>
        </Link>
      </div>

      <Suspense fallback={<TableSkeleton rows={5} columns={8} />}>
        <CallLogsTable />
      </Suspense>
    </div>
  )
}
