import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { UserCheck, Eye, Pencil, UserX } from 'lucide-react'

async function getSpareAssistants() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('passenger_assistants')
    .select('id, employee_id, spare_pa, employees(id, full_name, phone_number, employment_status)')
    .eq('spare_pa', true)
    .order('id', { ascending: true })

  if (error) {
    console.error('Error fetching spare PAs:', error)
    return []
  }
  return data || []
}

export default async function SpareAssistantsPage() {
  const assistants = await getSpareAssistants()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PA ID</TableHead>
            <TableHead>Employee ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assistants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-12">
                <UserX className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No spare passenger assistants</p>
                <p className="text-sm text-slate-400">
                  Mark PAs as &quot;Mark as spare&quot; when creating or editing a passenger assistant to list them here
                </p>
                <Link href="/dashboard/assistants" className="inline-block mt-3">
                  <Button variant="secondary" size="sm">View all PAs</Button>
                </Link>
              </TableCell>
            </TableRow>
          ) : (
            assistants.map((row: any) => {
              const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees
              return (
                <TableRow key={row.id} className="hover:bg-slate-50">
                  <TableCell className="text-slate-500">{row.id}</TableCell>
                  <TableCell className="text-slate-500">{row.employee_id}</TableCell>
                  <TableCell className="font-semibold text-slate-800">{emp?.full_name || 'N/A'}</TableCell>
                  <TableCell className="text-slate-600">{emp?.phone_number || '—'}</TableCell>
                  <TableCell className="text-slate-600">{emp?.employment_status || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/dashboard/assistants/${row.id}`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-violet-600 hover:bg-violet-50">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/assistants/${row.id}/edit`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-violet-600 hover:bg-violet-50">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
