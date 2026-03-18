import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { ArrowLeft, Pencil, FileDown, MapPin, Plus } from 'lucide-react'
import ExportTR1Button from './ExportTR1Button'
import { formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'
import RouteSessionsClient from './RouteSessionsClient'
import RouteDetailClient from './RouteDetailClient'
import RoutePointsManager from './RoutePointsManager'
import RouteDocumentsCard from './RouteDocumentsCard'

// Helper function to format time (HH:MM:SS to HH:MM)
function formatTime(time: string | null): string {
  if (!time) return 'N/A'
  // If time is in HH:MM:SS format, extract HH:MM
  if (time.includes(':')) {
    const parts = time.split(':')
    return `${parts[0]}:${parts[1]}`
  }
  return time
}

async function getRouteDetails(id: string) {
  const supabase = await createClient()

  const { data: route, error: routeError } = await supabase
    .from('routes')
    .select(`
      *,
      schools(name, address),
      driver:driver_id(employees(full_name, address, phone_number, personal_email)),
      pa:passenger_assistant_id(employees(full_name, address, phone_number, personal_email)),
      vehicles (
        id,
        vehicle_identifier,
        registration,
        make,
        model,
        plate_number,
        vehicle_type
      )
    `)
    .eq('id', id)
    .single()

  if (routeError || !route) {
    return null
  }

  // Get passengers on this route
  const { data: passengers } = await supabase
    .from('passengers')
    .select('*')
    .eq('route_id', id)

  // Get Pick-up Points with passenger information
  const { data: routePoints } = await supabase
    .from('route_points')
    .select(`
      *,
      passengers (
        id,
        full_name
      )
    `)
    .eq('route_id', id)
    .order('stop_order')

  // Get vehicle directly from route
  const vehicle = route.vehicles
    ? (Array.isArray(route.vehicles) ? route.vehicles[0] : route.vehicles)
    : null

  // Get all PAs assigned to this route (multiple PAs per route)
  const { data: routePas } = await supabase
    .from('route_passenger_assistants')
    .select(`
      employee_id,
      sort_order,
      employees(full_name, address, phone_number, personal_email)
    `)
    .eq('route_id', id)
    .order('sort_order')

  const paEmployeeIds = (routePas ?? []).map((r: any) => r.employee_id)
  const { data: paRows } = paEmployeeIds.length
    ? await supabase
        .from('passenger_assistants')
        .select('id, employee_id')
        .in('employee_id', paEmployeeIds)
    : { data: [] as { id: number; employee_id: number }[] | null }
  const paIdByEmployeeId = new Map((paRows ?? []).map((p: any) => [p.employee_id, p.id]))

  const routePasList = (routePas || []).map((r: any) => ({
    employee_id: r.employee_id,
    pa_id: paIdByEmployeeId.get(r.employee_id) ?? null,
    sort_order: r.sort_order,
    employees: r.employees,
  }))

  return {
    route,
    routePasList,
    passengers: passengers || [],
    routePoints: routePoints || [],
    vehicle,
  }
}

export default async function ViewRoutePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { from?: string }
}) {
  const data = await getRouteDetails(params.id)

  if (!data) {
    notFound()
  }

  const { route, routePasList, passengers, routePoints, vehicle } = data
  const backHref = searchParams?.from === 'school-overview' ? '/dashboard/school-overview' : '/dashboard/routes'

  return (
    <div className="space-y-2">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={backHref}>
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {route.route_number || `Route ${route.id}`}
            </h1>
            <p className="text-sm text-slate-500">Route Details & Assignments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportTR1Button routeId={route.id} />
          <Link href={`/dashboard/routes/${route.id}/edit`}>
            <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <RouteDetailClient route={route} routeId={route.id} routePasList={routePasList} />

      <Card>
        <CardContent className="p-2.5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 border-b border-slate-100 pb-1">Statistics</h2>
          <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
            <span className="text-xs text-slate-500">Total Passengers</span>
            <span className="text-sm font-bold text-slate-900">{passengers.length}</span>
          </div>
          <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
            <span className="text-xs text-slate-500">Crew Members</span>
            <span className="text-sm font-bold text-slate-900">
              {(route.driver_id ? 1 : 0) + (routePasList?.length ?? (route.passenger_assistant_id ? 1 : 0))}
            </span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-xs text-slate-500">Pick-up Points</span>
            <span className="text-sm font-bold text-slate-900">{routePoints.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Passengers Section */}
      <Card>
        <CardContent className="p-3">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-1.5">Passengers</h2>
          {passengers.length === 0 ? (
            <p className="text-center text-gray-500 py-2 text-sm">No passengers on this route.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Seat Number</TableHead>
                  <TableHead>Mobility Type</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passengers.map((passenger: any) => (
                  <TableRow key={passenger.id}>
                    <TableCell className="font-medium">{passenger.full_name}</TableCell>
                    <TableCell>{passenger.seat_number || 'N/A'}</TableCell>
                    <TableCell>{passenger.mobility_type || 'N/A'}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/passengers/${passenger.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pick-up Points Section */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2 border-b pb-1.5">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pick-up Points</h2>
            <RoutePointsManager routeId={route.id} routePoints={routePoints} />
          </div>
          {routePoints.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 font-medium mb-2">No Pick-up Points defined</p>
              <p className="text-sm text-gray-400 mb-4">Add pickup points to organize your route stops</p>
              <Link href={`/dashboard/routes/${route.id}/edit`}>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Pickup Points
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Point Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Passenger</TableHead>
                  <TableHead>AM Pickup Time</TableHead>
                  <TableHead>PM Drop Off Time</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routePoints.map((point: any) => {
                  const passenger = Array.isArray(point.passengers)
                    ? point.passengers[0]
                    : point.passengers
                  const passengerName = passenger?.full_name || null

                  return (
                    <TableRow key={point.id}>
                      <TableCell>{point.stop_order || 'N/A'}</TableCell>
                      <TableCell className="font-medium">{point.point_name || 'N/A'}</TableCell>
                      <TableCell>{point.address || 'N/A'}</TableCell>
                      <TableCell>
                        {point.stop_order === 1 ? (
                          <span className="text-blue-600 font-medium">PA Pickup</span>
                        ) : passengerName ? (
                          <Link
                            href={`/dashboard/passengers/${point.passenger_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {passengerName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatTime(point.pickup_time_am)}
                      </TableCell>
                      <TableCell>
                        {formatTime(point.pickup_time_pm)}
                      </TableCell>
                      <TableCell>
                        {point.latitude && point.longitude
                          ? `${point.latitude}, ${point.longitude}`
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/routes/${route.id}/edit`}>
                          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/10">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Route Sessions & Attendance Section */}
      <RouteSessionsClient routeId={parseInt(params.id)} passengers={passengers} />

      {/* Route Documents */}
      <RouteDocumentsCard routeId={route.id} />
    </div>
  )
}

