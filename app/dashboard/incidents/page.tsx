import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Plus, Eye, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { IncidentSearchFilters } from './IncidentSearchFilters'

async function getIncidents(filters?: { routeSessionId?: string; search?: string; status?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from('incidents')
    .select('*, employees(full_name), vehicles(vehicle_identifier), routes(route_number), route_sessions(id, session_date, session_type, routes(route_number))')
    .order('reported_at', { ascending: false })

  if (filters?.routeSessionId) {
    query = query.eq('route_session_id', parseInt(filters.routeSessionId))
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching incidents:', error)
    return []
  }

  let result = data || []

  if (filters?.search && filters.search.trim()) {
    const term = filters.search.trim().toLowerCase()
    result = result.filter((incident: any) => {
      const type = incident.incident_type?.toLowerCase() || ''
      const desc = incident.description?.toLowerCase() || ''
      const ref = incident.reference_number?.toLowerCase() || ''
      const emp = incident.employees?.full_name?.toLowerCase() || ''
      const route = incident.routes?.route_number?.toLowerCase() || ''
      const sessionRoute = (incident.route_sessions as any)?.routes?.route_number?.toLowerCase() || ''
      return type.includes(term) || desc.includes(term) || ref.includes(term) || emp.includes(term) || route.includes(term) || sessionRoute.includes(term)
    })
  }

  if (filters?.status === 'open') {
    result = result.filter((i: any) => !i.resolved)
  } else if (filters?.status === 'resolved') {
    result = result.filter((i: any) => i.resolved)
  }

  return result
}

async function IncidentsTable({
  routeSessionId,
  search,
  status,
}: {
  routeSessionId?: string
  search?: string
  status?: string
}) {
  const incidents = await getIncidents({ routeSessionId, search, status })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Route Session</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reported At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No incidents found</p>
                <p className="text-sm text-slate-400">Great news! Your fleet is running smoothly</p>
              </TableCell>
            </TableRow>
          ) : (
            incidents.map((incident: any) => (
              <TableRow key={incident.id} className="hover:bg-slate-50">
                <TableCell className="text-slate-500">#{incident.id}</TableCell>
                <TableCell className="font-semibold text-slate-800">{incident.incident_type || 'N/A'}</TableCell>
                <TableCell className="text-slate-600">{incident.employees?.full_name || 'N/A'}</TableCell>
                <TableCell className="text-slate-600">{incident.vehicles?.vehicle_identifier || 'N/A'}</TableCell>
                <TableCell className="text-slate-600">{incident.routes?.route_number || 'N/A'}</TableCell>
                <TableCell>
                  {incident.route_sessions ? (
                    Array.isArray(incident.route_sessions) && incident.route_sessions.length > 0 ? (
                      <div className="space-y-1">
                        {incident.route_sessions.map((session: any) => (
                          <div key={session.id} className="text-xs text-slate-500">
                            {formatDateTime(session.session_date)} - {session.session_type}
                            {session.routes?.route_number && ` (${session.routes.route_number})`}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        {formatDateTime((incident.route_sessions as any).session_date)} - {(incident.route_sessions as any).session_type}
                        {(incident.route_sessions as any).routes?.route_number && ` (${(incident.route_sessions as any).routes.route_number})`}
                      </div>
                    )
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {incident.resolved ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">
                      <CheckCircle className="h-3 w-3" />
                      Resolved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-rose-100 text-rose-700">
                      <XCircle className="h-3 w-3" />
                      Open
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-500">{formatDateTime(incident.reported_at)}</TableCell>
                <TableCell>
                  <Link href={`/dashboard/incidents/${incident.id}`} prefetch={true}>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ route_session_id?: string; search?: string; status?: string }>
}) {
  const params = await searchParams
  const routeSessionId = params.route_session_id
  const search = params.search
  const status = params.status

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
            <AlertCircle className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Incidents</h1>
            <p className="text-sm text-slate-500">
              {routeSessionId ? 'Incidents for Route Session' : 'Track and manage all incidents'}
            </p>
          </div>
        </div>
        <Link href="/dashboard/incidents/create" prefetch={true}>
          <Button className="bg-primary hover:bg-primary/90 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Report Incident
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="h-10 w-full max-w-2xl rounded-lg bg-slate-100 animate-pulse" />}>
        <IncidentSearchFilters />
      </Suspense>

      <Suspense key={JSON.stringify({ routeSessionId, search, status })} fallback={<TableSkeleton rows={5} columns={8} />}>
        <IncidentsTable routeSessionId={routeSessionId} search={search} status={status} />
      </Suspense>
    </div>
  )
}

