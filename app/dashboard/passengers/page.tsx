import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { Plus, Eye, Pencil, MessageSquare, UserCheck } from 'lucide-react'
import { PassengerSearchFilters } from './PassengerSearchFilters'

const PAGE_SIZE = 25

function buildPassengersQueryString(args: {
  page?: number
  search?: string
  mobility_type?: string
}) {
  const p = new URLSearchParams()
  if (args.search?.trim()) p.set('search', args.search.trim())
  if (args.mobility_type && args.mobility_type !== 'all') p.set('mobility_type', args.mobility_type)
  if (args.page && args.page > 1) p.set('page', String(args.page))
  const q = p.toString()
  return q ? `?${q}` : ''
}

async function getPassengers(
  filters: { search?: string; mobility_type?: string },
  requestedPage: number
) {
  const supabase = await createClient()
  let query = supabase
    .from('passengers')
    .select('*, schools(name), routes(route_number)', { count: 'exact' })
    .order('id', { ascending: false })

  if (filters.mobility_type && filters.mobility_type !== 'all') {
    query = query.eq('mobility_type', filters.mobility_type)
  }

  if (filters.search?.trim()) {
    query = query.ilike('full_name', `%${filters.search.trim()}%`)
  }

  const from = (requestedPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('[passengers-list] Error fetching passengers:', error)
    return { passengers: [] as any[], totalCount: 0, page: 1, pageSize: PAGE_SIZE }
  }

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  if (requestedPage > totalPages) {
    const qs = buildPassengersQueryString({
      page: totalPages,
      search: filters.search,
      mobility_type: filters.mobility_type,
    })
    redirect(`/dashboard/passengers${qs}`)
  }

  const rows = data || []
  const passengerIds = rows.map((p) => p.id)

  const countsMap = new Map<number, number>()
  if (passengerIds.length > 0) {
    const { data: updateRows } = await supabase
      .from('passenger_updates')
      .select('passenger_id')
      .in('passenger_id', passengerIds)

    updateRows?.forEach((update) => {
      countsMap.set(update.passenger_id, (countsMap.get(update.passenger_id) || 0) + 1)
    })
  }

  const passengersWithCounts = rows.map((passenger) => ({
    ...passenger,
    updateCount: countsMap.get(passenger.id) || 0,
  }))

  if (process.env.NODE_ENV === 'development') {
    console.debug('[passengers-list]', {
      page: requestedPage,
      totalCount,
      returned: passengersWithCounts.length,
      hasSearch: Boolean(filters.search?.trim()),
    })
  }

  return {
    passengers: passengersWithCounts,
    totalCount,
    page: requestedPage,
    pageSize: PAGE_SIZE,
  }
}

async function PassengersTable({
  search,
  mobility_type,
  requestedPage,
}: {
  search?: string
  mobility_type?: string
  requestedPage: number
}) {
  const filters = { search, mobility_type }
  const { passengers, totalCount, page, pageSize } = await getPassengers(filters, requestedPage)

  const base = {
    search: filters.search,
    mobility_type: filters.mobility_type,
  }

  const prevHref =
    page > 1
      ? `/dashboard/passengers${buildPassengersQueryString({ ...base, page: page - 1 })}`
      : null
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const nextHref =
    page < totalPages
      ? `/dashboard/passengers${buildPassengersQueryString({ ...base, page: page + 1 })}`
      : null

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Mobility Type</TableHead>
              <TableHead>Seat Number</TableHead>
              <TableHead>Updates</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {passengers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No passengers found</p>
                  <p className="text-sm text-slate-400">Add your first passenger to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              passengers.map((passenger: any) => (
                <TableRow key={passenger.id} className="hover:bg-slate-50">
                  <TableCell className="text-slate-500">#{passenger.id}</TableCell>
                  <TableCell className="font-semibold text-slate-800">{passenger.full_name}</TableCell>
                  <TableCell className="text-slate-600">{passenger.schools?.name || 'N/A'}</TableCell>
                  <TableCell className="text-slate-600">{passenger.routes?.route_number || 'N/A'}</TableCell>
                  <TableCell className="text-slate-600">{passenger.mobility_type || 'N/A'}</TableCell>
                  <TableCell className="text-slate-600">{passenger.seat_number || 'N/A'}</TableCell>
                  <TableCell>
                    {passenger.updateCount > 0 ? (
                      <div
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"
                        title={`${passenger.updateCount} update(s) recorded`}
                      >
                        <MessageSquare className="h-3 w-3" />
                        {passenger.updateCount}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/dashboard/passengers/${passenger.id}`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-[#023E8A] hover:bg-blue-50">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/passengers/${passenger.id}/edit`} prefetch={true}>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-[#023E8A] hover:bg-blue-50">
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

      {totalCount > 0 && (
        <PaginationBar
          currentPage={page}
          totalRows={totalCount}
          pageSize={pageSize}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      )}
    </div>
  )
}

export default async function PassengersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    mobility_type?: string
    page?: string
  }>
}) {
  const params = await searchParams
  const rawPage = parseInt(params?.page ?? '1', 10)
  const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1

  const filters = {
    search: params?.search,
    mobility_type: params?.mobility_type,
  }

  const suspenseKey = JSON.stringify({ ...filters, page: requestedPage })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <UserCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Passengers</h1>
            <p className="text-sm text-slate-500">Manage all passengers in your fleet system</p>
          </div>
        </div>
        <Link href="/dashboard/passengers/create" prefetch={true}>
          <Button className="bg-[#023E8A] hover:bg-[#023E8A]/90 text-white shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Passenger
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="h-10 w-full max-w-md rounded-lg bg-slate-100 animate-pulse" />}>
        <PassengerSearchFilters />
      </Suspense>

      <Suspense key={suspenseKey} fallback={<TableSkeleton rows={5} columns={8} />}>
        <PassengersTable search={filters.search} mobility_type={filters.mobility_type} requestedPage={requestedPage} />
      </Suspense>
    </div>
  )
}
