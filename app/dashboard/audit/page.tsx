import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/utils'

async function getAuditLogs() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('*, users(email)')
    .order('change_time', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching audit logs:', error)
    return []
  }

  return data || []
}

async function AuditLogsTable() {
  const logs = await getAuditLogs()

  return (
    <div className="rounded-md border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Table</TableHead>
            <TableHead>Record ID</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Changed By</TableHead>
            <TableHead>Change Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500">
                No audit logs found.
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log: any) => (
              <TableRow key={log.id}>
                <TableCell>{log.id}</TableCell>
                <TableCell className="font-medium">{log.table_name}</TableCell>
                <TableCell>{log.record_id}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      log.action === 'CREATE'
                        ? 'bg-green-100 text-green-800'
                        : log.action === 'UPDATE'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {log.action}
                  </span>
                </TableCell>
                <TableCell>{log.users?.email || 'N/A'}</TableCell>
                <TableCell>{formatDateTime(log.change_time)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default function AuditLogPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Audit Log</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track all changes made in the system (showing last 100 entries)
          </p>
        </div>
      </div>

      <Suspense fallback={<TableSkeleton rows={5} columns={6} />}>
        <AuditLogsTable />
      </Suspense>
    </div>
  )
}
