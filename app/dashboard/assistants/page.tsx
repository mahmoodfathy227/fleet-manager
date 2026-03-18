import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Eye, Plus, Pencil, UserCheck, CheckCircle, XCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AssistantSearchFilters } from './AssistantSearchFilters'

async function getAssistants(filters?: {
  search?: string
  status?: string
  can_work?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('passenger_assistants')
    .select('*, employees(full_name, phone_number, employment_status, can_work)')
    .order('employee_id')

  if (error) {
    console.error('Error fetching assistants:', error)
    return []
  }

  // Apply filters in memory for employee-related fields
  let filtered = data || []

  if (filters?.search && filters.search.trim()) {
    const searchTerm = filters.search.trim().toLowerCase()
    filtered = filtered.filter((assistant: any) =>
      assistant.employees?.full_name?.toLowerCase().includes(searchTerm)
    )
  }

  if (filters?.status && filters.status !== 'all') {
    filtered = filtered.filter((assistant: any) =>
      assistant.employees?.employment_status === filters.status
    )
  }

  if (filters?.can_work === 'yes') {
    filtered = filtered.filter((assistant: any) => assistant.employees?.can_work === true)
  } else if (filters?.can_work === 'no') {
    filtered = filtered.filter((assistant: any) => assistant.employees?.can_work === false)
  }

  return filtered
}

// Helper to get missing and expired certificates for a PA
function getMissingAndExpiredCertificates(assistant: any): string[] {
  const today = new Date()
  const issues: string[] = []

  // Check TAS Badge (required)
  if (!assistant.tas_badge_expiry_date) {
    issues.push('Missing TAS Badge expiry date')
  } else {
    const expiry = new Date(assistant.tas_badge_expiry_date)
    if (expiry < today) {
      issues.push('Expired TAS Badge')
    }
  }

  return issues
}

async function AssistantsTable(filters?: {
  search?: string
  status?: string
  can_work?: string
}) {
  const assistants = await getAssistants(filters)

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
            <TableHead>TAS Badge Number</TableHead>
            <TableHead>TAS Badge Expiry</TableHead>
            <TableHead>DBS Number</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assistants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12">
                <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No passenger assistants found</p>
                <p className="text-sm text-slate-400">Add your first passenger assistant to get started</p>
              </TableCell>
            </TableRow>
          ) : (
            assistants.map((assistant: any) => {
              const missingAndExpired = getMissingAndExpiredCertificates(assistant)

              return (
                <TableRow key={assistant.employee_id} className="hover:bg-slate-50">
                  <TableCell className="text-slate-500">#{assistant.employee_id}</TableCell>
                  <TableCell className="font-semibold text-slate-800">{assistant.employees?.full_name || 'N/A'}</TableCell>
                  <TableCell className="text-slate-600">{assistant.employees?.phone_number || 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${assistant.employees?.employment_status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                      {assistant.employees?.employment_status || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {assistant.employees?.can_work === false ? (
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
                  <TableCell className="text-slate-600">{assistant.tas_badge_number || 'N/A'}</TableCell>
                  <TableCell className="text-slate-600">{formatDate(assistant.tas_badge_expiry_date)}</TableCell>
                  <TableCell className="text-slate-600">{assistant.dbs_number || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/dashboard/assistants/${assistant.id}`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10" title="View PA Profile"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <Link href={`/dashboard/assistants/${assistant.id}/edit`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10" title="Edit Passenger Assistant"><Pencil className="h-4 w-4" /></Button>
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

export default async function AssistantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    can_work?: string
  }>
}) {
  const params = await searchParams
  const filters = {
    search: params?.search,
    status: params?.status,
    can_work: params?.can_work,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <UserCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Passenger Assistants</h1>
            <p className="text-sm text-slate-500">View all passenger assistants and their certifications</p>
          </div>
        </div>
        <Link href="/dashboard/assistants/create" prefetch={true}>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
            <Plus className="mr-2 h-4 w-4" />
            Add Passenger Assistant
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="h-10 w-full max-w-2xl rounded-lg bg-slate-100 animate-pulse" />}>
        <AssistantSearchFilters />
      </Suspense>

      <Suspense key={JSON.stringify(filters)} fallback={<TableSkeleton rows={5} columns={9} />}>
        <AssistantsTable search={filters.search} status={filters.status} can_work={filters.can_work} />
      </Suspense>
    </div>
  )
}

