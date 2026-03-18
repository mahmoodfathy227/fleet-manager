import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Eye, Pencil, Plus, UserCog, CheckCircle, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { DriverSearchFilters } from './DriverSearchFilters'

async function getDrivers(filters?: {
  search?: string
  status?: string
  can_work?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from('drivers')
    .select(`
      *,
      employees(full_name, phone_number, employment_status, can_work)
    `)

  // Apply filters through employees relation
  if (filters?.search || filters?.status || filters?.can_work) {
    // We need to filter by employee fields, so we'll filter after fetching
    // or use a more complex query
  }

  const { data, error } = await query.order('employee_id')

  if (error) {
    console.error('Error fetching drivers:', error)
    return []
  }

  // Apply filters in memory for employee-related fields
  let filtered = data || []

  if (filters?.search && filters.search.trim()) {
    const searchTerm = filters.search.trim().toLowerCase()
    filtered = filtered.filter((driver: any) =>
      driver.employees?.full_name?.toLowerCase().includes(searchTerm)
    )
  }

  if (filters?.status && filters.status !== 'all') {
    filtered = filtered.filter((driver: any) =>
      driver.employees?.employment_status === filters.status
    )
  }

  if (filters?.can_work === 'yes') {
    filtered = filtered.filter((driver: any) => driver.employees?.can_work === true)
  } else if (filters?.can_work === 'no') {
    filtered = filtered.filter((driver: any) => driver.employees?.can_work === false)
  }

  return filtered
}

// Helper to get missing and expired certificates for a driver
function getMissingAndExpiredCertificates(driver: any): string[] {
  const today = new Date()
  const issues: string[] = []

  // Check TAS Badge (required)
  if (!driver.tas_badge_expiry_date) {
    issues.push('Missing TAS Badge expiry date')
  } else {
    const expiry = new Date(driver.tas_badge_expiry_date)
    if (expiry < today) {
      issues.push('Expired TAS Badge')
    }
  }

  return issues
}

async function DriversTable({
  search,
  status,
  can_work,
}: {
  search?: string
  status?: string
  can_work?: string
}) {
  const drivers = await getDrivers({ search, status, can_work })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee ID</TableHead>
            <TableHead>Full Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Can Work</TableHead>
            <TableHead>TAS Badge Expiry</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12">
                <UserCog className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No drivers found</p>
                <p className="text-sm text-slate-400">Add your first driver to get started</p>
              </TableCell>
            </TableRow>
          ) : (
            drivers.map((driver: any) => {
              const missingAndExpired = getMissingAndExpiredCertificates(driver)

              return (
                <TableRow key={driver.employee_id} className="hover:bg-slate-50">
                  <TableCell className="text-slate-500">#{driver.employee_id}</TableCell>
                  <TableCell className="font-semibold text-slate-800">{driver.employees?.full_name || 'N/A'}</TableCell>
                  <TableCell className="text-slate-600">{driver.employees?.phone_number || 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${driver.employees?.employment_status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                      {driver.employees?.employment_status || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {driver.employees?.can_work === false ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-rose-100 text-rose-700">
                          <XCircle className="h-3 w-3" />
                          CANNOT WORK
                        </span>
                        {missingAndExpired.length > 0 ? (
                          <div className="text-xs text-rose-600 font-medium">
                            {missingAndExpired.join(', ')}
                          </div>
                        ) : (
                          <div className="text-xs text-amber-600 font-medium">
                            Status may be out of sync
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-700">
                        <CheckCircle className="h-3 w-3" />
                        Authorized
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600">{formatDate(driver.tas_badge_expiry_date)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/dashboard/drivers/${driver.employee_id}`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/drivers/${driver.employee_id}/edit`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
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

export default async function DriversPage({
  searchParams,
}: {
  searchParams: {
    search?: string
    status?: string
    can_work?: string
  }
}) {
  // Build filters from search params (Next.js 14 - searchParams is not a Promise)
  const filters = {
    search: searchParams?.search || undefined,
    status: searchParams?.status || undefined,
    can_work: searchParams?.can_work || undefined,
  }

  // Create a unique key for Suspense based on all filter params
  const suspenseKey = JSON.stringify(filters)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <UserCog className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Drivers</h1>
            <p className="text-sm text-slate-500">View all drivers and their certifications</p>
          </div>
        </div>
        <Link href="/dashboard/drivers/create" prefetch={true}>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="h-10 w-full max-w-2xl rounded-lg bg-slate-100 animate-pulse" />}>
        <DriverSearchFilters />
      </Suspense>

      <Suspense key={suspenseKey} fallback={<TableSkeleton rows={5} columns={7} />}>
        <DriversTable {...filters} />
      </Suspense>
    </div>
  )
}

