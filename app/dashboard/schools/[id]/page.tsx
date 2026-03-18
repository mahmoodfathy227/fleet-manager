import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { ArrowLeft, Pencil, Plus, UserCog } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'
import SchoolRouteSessionsClient from './SchoolRouteSessionsClient'
import DeleteSchoolButton from './DeleteSchoolButton'
import ExportTAS5Button from './ExportTAS5Button'
import SchoolDocumentsCard from './SchoolDocumentsCard'

async function getSchoolDetails(id: string) {
  const supabase = await createClient()

  // Get school details - use maybeSingle() to handle cases where school doesn't exist
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (schoolError) {
    console.error('Error fetching school:', schoolError)
    return null
  }

  if (!school) {
    return null
  }

  // Get routes for this school with crew information
  const { data: routes, error: routesError } = await supabase
    .from('routes')
    .select(`
      *,
      driver:driver_id(employees(full_name)),
      pa:passenger_assistant_id(employees(full_name))
    `)
    .eq('school_id', id)

  const routeIds = (routes || []).map((r: any) => r.id)
  const { data: routePasData } = routeIds.length > 0
    ? await supabase
      .from('route_passenger_assistants')
      .select('route_id, employee_id, sort_order, employees(full_name)')
      .in('route_id', routeIds)
      .order('sort_order')
    : { data: [] }

  // Map route_id -> array of { id, name } for PAs
  const routePasMap: Record<number, Array<{ id: number; name: string }>> = {}
    ; (routePasData || []).forEach((r: any) => {
      if (!routePasMap[r.route_id]) routePasMap[r.route_id] = []
      const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees
      routePasMap[r.route_id].push({
        id: r.employee_id,
        name: emp?.full_name || 'Unknown',
      })
    })

  // Get passengers for this school
  const { data: passengers, error: passengersError } = await supabase
    .from('passengers')
    .select('*, routes(route_number)')
    .eq('school_id', id)

  // Get coordinators assigned to this school
  const { data: coordinatorAssignments } = await supabase
    .from('coordinator_school_assignments')
    .select('employee_id, employees(id, full_name, role)')
    .eq('school_id', id)

  const coordinators: Array<{ id: number; full_name: string }> = []
  coordinatorAssignments?.forEach((row: any) => {
    const emp = row.employees
    const employee = Array.isArray(emp) ? emp[0] : emp
    if (employee && employee.id) {
      coordinators.push({ id: employee.id, full_name: employee.full_name || 'Unknown' })
    }
  })

  // Calculate crew count from routes (unique drivers and PAs)
  const uniqueCrewMembers = new Set<number>()
  const crewAssignments: Array<{
    route_id: number
    route_number: string | null
    driver_id: number | null
    driver_name: string | null
    pas: Array<{ id: number; name: string }>
  }> = []

  routes?.forEach((route: any) => {
    if (route.driver_id) {
      uniqueCrewMembers.add(route.driver_id)
    }
    const pasForRoute: Array<{ id: number; name: string }> = routePasMap[route.id]
      ? [...routePasMap[route.id]]
      : route.passenger_assistant_id
        ? (() => {
          const pa = Array.isArray(route.pa) ? route.pa[0] : route.pa
          const paEmp = Array.isArray(pa?.employees) ? pa?.employees[0] : pa?.employees
          return [{ id: route.passenger_assistant_id, name: paEmp?.full_name || 'Unknown' }]
        })()
        : []
    pasForRoute.forEach((p) => uniqueCrewMembers.add(p.id))
    const driver = Array.isArray(route.driver) ? route.driver[0] : route.driver
    const driverEmp = Array.isArray(driver?.employees) ? driver?.employees[0] : driver?.employees
    crewAssignments.push({
      route_id: route.id,
      route_number: route.route_number,
      driver_id: route.driver_id,
      driver_name: driverEmp?.full_name || null,
      pas: pasForRoute,
    })
  })

  return {
    school,
    routes: routes || [],
    crewCount: uniqueCrewMembers.size,
    crewAssignments,
    passengers: passengers || [],
    coordinators,
  }
}

export default async function ViewSchoolPage({
  params,
}: {
  params: { id: string }
}) {
  const data = await getSchoolDetails(params.id)

  if (!data) {
    notFound()
  }

  const { school, routes, crewCount, crewAssignments, passengers, coordinators } = data

  return (
    <div className="space-y-2">
      {/* Header with Back Button - match route screen */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/schools">
            <Button variant="outline" size="sm" className="h-8 px-2.5 gap-1.5 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{school.name}</h1>
            <p className="text-xs text-slate-500">School Details & Information</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ExportTAS5Button schoolId={school.id} schoolName={school.name} />
          <Link href={`/dashboard/schools/${school.id}/edit`}>
            <Button variant="outline" size="sm" className="border-slate-300 text-slate-600 hover:bg-slate-50 h-8 px-2.5">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </Link>
          <DeleteSchoolButton
            schoolId={school.id}
            schoolName={school.name}
            routeCount={routes.length}
            passengerCount={passengers.length}
          />
        </div>
      </div>

      {/* Basic Information - compact card like route */}
      <div className="flex justify-center">
        <Card className="w-full max-w-[33.6rem]">
          <CardContent className="p-2.5 space-y-0">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 border-b pb-1">Basic Information</h2>
            <div className="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100">
              <span className="text-xs text-slate-500 whitespace-nowrap">School ID</span>
              <span className="text-xs font-medium text-slate-900 text-right">{school.id}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100">
              <span className="text-xs text-slate-500 whitespace-nowrap">School Name</span>
              <span className="text-xs font-medium text-slate-900 text-right">{school.name}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100">
              <span className="text-xs text-slate-500 whitespace-nowrap">Ref Number</span>
              <span className="text-xs font-medium text-slate-900 text-right">{school.ref_number || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100">
              <span className="text-xs text-slate-500 whitespace-nowrap">Address</span>
              <span className="text-xs font-medium text-slate-900 text-right">{school.address || 'N/A'}</span>
            </div>
            {school.phone_number && (
              <div className="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100">
                <span className="text-xs text-slate-500 whitespace-nowrap">School Phone</span>
                <a href={`tel:${school.phone_number}`} className="text-xs font-medium text-primary hover:underline text-right">{school.phone_number}</a>
              </div>
            )}
            {school.contact_name && (
              <div className="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100">
                <span className="text-xs text-slate-500 whitespace-nowrap">Contact Name</span>
                <span className="text-xs font-medium text-slate-900 text-right">{school.contact_name}</span>
              </div>
            )}
            {school.contact_phone && (
              <div className="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100">
                <span className="text-xs text-slate-500 whitespace-nowrap">Contact Phone</span>
                <a href={`tel:${school.contact_phone}`} className="text-xs font-medium text-primary hover:underline text-right">{school.contact_phone}</a>
              </div>
            )}
            {school.contact_email && (
              <div className="flex items-center justify-between gap-4 py-0.5 border-b border-slate-100">
                <span className="text-xs text-slate-500 whitespace-nowrap">Contact Email</span>
                <a href={`mailto:${school.contact_email}`} className="text-xs font-medium text-primary hover:underline text-right truncate">{school.contact_email}</a>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 py-0.5">
              <span className="text-xs text-slate-500 whitespace-nowrap">Created At</span>
              <span className="text-xs font-medium text-slate-900 text-right">{formatDate(school.created_at)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics - match route stats card */}
      <Card>
        <CardContent className="p-2.5 space-y-0">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 border-b pb-1">Statistics</h2>
          <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
            <span className="text-xs text-slate-500">Total Routes</span>
            <span className="text-sm font-bold text-slate-900">{routes.length}</span>
          </div>
          <div className="flex items-center justify-between py-0.5 border-b border-slate-100">
            <span className="text-xs text-slate-500">Total Crew</span>
            <span className="text-sm font-bold text-slate-900">{crewCount}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-xs text-slate-500">Total Passengers</span>
            <span className="text-sm font-bold text-slate-900">{passengers.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Coordinators - compact card */}
      <Card>
        <CardContent className="p-2.5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 border-b pb-1 flex items-center gap-1.5">
            <UserCog className="h-3.5 w-3.5" />
            Coordinators
          </h2>
          {coordinators.length === 0 ? (
            <p className="text-center text-gray-500 py-1.5 text-xs">No coordinators assigned. Assign from the employee edit page when role is Coordinator.</p>
          ) : (
            <ul className="space-y-1">
              {coordinators.map((coord) => (
                <li key={coord.id}>
                  <Link href={`/dashboard/employees/${coord.id}`} className="text-xs font-medium text-blue-600 hover:underline">
                    {coord.full_name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Routes Section - match route screen table card */}
      <Card>
        <CardContent className="p-2.5">
          <div className="flex items-center justify-between mb-1.5 border-b pb-1">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Routes</h2>
            <Link href={`/dashboard/routes/create?school_id=${school.id}`}>
              <Button size="sm" className="h-7 px-2 text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Route
              </Button>
            </Link>
          </div>
          {routes.length === 0 ? (
            <p className="text-center text-gray-500 py-1.5 text-xs">No routes found for this school.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-1.5">Route Number</TableHead>
                  <TableHead className="text-xs py-1.5">Created At</TableHead>
                  <TableHead className="text-xs py-1.5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route: any) => (
                  <TableRow key={route.id}>
                    <TableCell className="font-medium text-xs py-1.5">{route.route_number || `Route ${route.id}`}</TableCell>
                    <TableCell className="text-xs py-1.5">{formatDate(route.created_at)}</TableCell>
                    <TableCell className="py-1.5">
                      <Link href={`/dashboard/routes/${route.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Crew Assignments - compact card */}
      <Card>
        <CardContent className="p-2.5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 border-b pb-1">Crew Assignments</h2>
          {crewAssignments.length === 0 || crewAssignments.every(c => !c.driver_id && c.pas.length === 0) ? (
            <p className="text-center text-gray-500 py-1.5 text-xs">No crew assignments found for this school.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-1.5">Route</TableHead>
                  <TableHead className="text-xs py-1.5">Driver</TableHead>
                  <TableHead className="text-xs py-1.5">Passenger Assistant(s)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crewAssignments.map((assignment) => (
                  <TableRow key={assignment.route_id}>
                    <TableCell className="text-xs py-1.5">{assignment.route_number || `Route ${assignment.route_id}`}</TableCell>
                    <TableCell className="text-xs py-1.5">
                      {assignment.driver_id ? (
                        <Link href={`/dashboard/employees/${assignment.driver_id}`} className="text-blue-600 hover:underline">
                          {assignment.driver_name || 'Unknown'}
                        </Link>
                      ) : (
                        <span className="text-gray-400">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs py-1.5">
                      {assignment.pas.length > 0 ? (
                        <span className="flex flex-wrap gap-x-1 gap-y-0.5">
                          {assignment.pas.map((pa, idx) => (
                            <span key={pa.id}>
                              {idx > 0 && ', '}
                              <Link href={`/dashboard/employees/${pa.id}`} className="text-blue-600 hover:underline">
                                {pa.name || 'Unknown'}
                              </Link>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not assigned</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Passengers Section - match route screen */}
      <Card>
        <CardContent className="p-2.5">
          <div className="flex items-center justify-between mb-1.5 border-b pb-1">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Passengers</h2>
            <Link href={`/dashboard/passengers/create?school_id=${school.id}`}>
              <Button size="sm" className="h-7 px-2 text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Passenger
              </Button>
            </Link>
          </div>
          {passengers.length === 0 ? (
            <p className="text-center text-gray-500 py-1.5 text-xs">No passengers found for this school.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-1.5">Full Name</TableHead>
                  <TableHead className="text-xs py-1.5">Route</TableHead>
                  <TableHead className="text-xs py-1.5">Mobility Type</TableHead>
                  <TableHead className="text-xs py-1.5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passengers.map((passenger: any) => (
                  <TableRow key={passenger.id}>
                    <TableCell className="font-medium text-xs py-1.5">{passenger.full_name}</TableCell>
                    <TableCell className="text-xs py-1.5">{passenger.routes?.route_number || 'N/A'}</TableCell>
                    <TableCell className="text-xs py-1.5">{passenger.mobility_type || 'N/A'}</TableCell>
                    <TableCell className="py-1.5">
                      <Link href={`/dashboard/passengers/${passenger.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Documents Section */}
      <SchoolDocumentsCard schoolId={school.id} />

      {/* Route Sessions & Attendance Section */}
      {routes.length > 0 && (
        <SchoolRouteSessionsClient schoolId={parseInt(params.id)} routes={routes} />
      )}
    </div>
  )
}

