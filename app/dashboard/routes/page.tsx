import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Plus, Eye, Pencil, Route } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { RouteSearchFilters } from './RouteSearchFilters'

async function getRoutes(filters?: { search?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('routes')
    .select('*, schools(name)')

  // Apply search filter (route_number or school name)
  if (filters?.search) {
    const searchTerm = filters.search.trim().toLowerCase()
    // We'll filter in memory since we need to search in related school name
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching routes:', error)
    return []
  }

  // Apply search filter in memory for route_number and school name
  let filtered = data || []
  if (filters?.search && filters.search.trim()) {
    const searchTerm = filters.search.trim().toLowerCase()
    filtered = filtered.filter((route: any) =>
      route.route_number?.toLowerCase().includes(searchTerm) ||
      route.schools?.name?.toLowerCase().includes(searchTerm)
    )
  }

  return filtered
}

async function RoutesTable(filters?: { search?: string }) {
  const routes = await getRoutes(filters)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Route Number</TableHead>
            <TableHead>School</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12">
                <Route className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No routes found</p>
                <p className="text-sm text-slate-400">Add your first route to get started</p>
              </TableCell>
            </TableRow>
          ) : (
            routes.map((route: any) => (
              <TableRow key={route.id} className="hover:bg-slate-50">
                <TableCell className="text-slate-500">#{route.id}</TableCell>
                <TableCell className="font-semibold text-slate-800">{route.route_number || `Route ${route.id}`}</TableCell>
                <TableCell className="text-slate-600">{route.schools?.name || 'N/A'}</TableCell>
                <TableCell className="text-slate-500">{formatDate(route.created_at)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/routes/${route.id}`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/routes/${route.id}/edit`} prefetch={true}>
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

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const params = await searchParams
  const filters = { search: params?.search }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Route className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Routes</h1>
            <p className="text-sm text-slate-500">Manage all routes in your fleet system</p>
          </div>
        </div>
        <Link href="/dashboard/routes/create" prefetch={true}>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
            <Plus className="mr-2 h-4 w-4" />
            Add Route
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="h-10 w-full max-w-md rounded-lg bg-slate-100 animate-pulse" />}>
        <RouteSearchFilters />
      </Suspense>

      <Suspense key={JSON.stringify(filters)} fallback={<TableSkeleton rows={5} columns={5} />}>
        <RoutesTable search={filters.search} />
      </Suspense>
    </div>
  )
}


