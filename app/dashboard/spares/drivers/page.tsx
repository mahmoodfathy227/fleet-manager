import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { UserCog, Eye, Pencil, UserX } from 'lucide-react'

async function getSpareDrivers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('employee_id, spare_driver, employees(id, full_name, phone_number, employment_status)')
    .eq('spare_driver', true)
    .order('employee_id', { ascending: true })

  if (error) {
    console.error('Error fetching spare drivers:', error)
    return []
  }
  return data || []
}

export default async function SpareDriversPage() {
  const drivers = await getSpareDrivers()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12">
                <UserX className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No spare drivers</p>
                <p className="text-sm text-slate-400">
                  Mark drivers as &quot;Spare Driver&quot; when creating or editing a driver to list them here
                </p>
                <Link href="/dashboard/drivers" className="inline-block mt-3">
                  <Button variant="secondary" size="sm">View all drivers</Button>
                </Link>
              </TableCell>
            </TableRow>
          ) : (
            drivers.map((row: any) => {
              const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees
              return (
                <TableRow key={row.employee_id} className="hover:bg-slate-50">
                  <TableCell className="text-slate-500">{row.employee_id}</TableCell>
                  <TableCell className="font-semibold text-slate-800">{emp?.full_name || 'N/A'}</TableCell>
                  <TableCell className="text-slate-600">{emp?.phone_number || '—'}</TableCell>
                  <TableCell className="text-slate-600">{emp?.employment_status || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/dashboard/drivers/${row.employee_id}`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-violet-600 hover:bg-violet-50">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/drivers/${row.employee_id}/edit`} prefetch={true}>
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
