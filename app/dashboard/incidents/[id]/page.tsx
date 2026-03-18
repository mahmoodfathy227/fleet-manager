import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, ExternalLink, Users, UserCog, Car, MapPin } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { notFound } from 'next/navigation'
import IncidentToggleButton from './IncidentToggleButton'
import IncidentDocuments from './IncidentDocuments'
import IncidentReportForms from './IncidentReportForms'
import IncidentPartyEntries from './IncidentPartyEntries'

async function getIncident(id: string) {
  const supabase = await createClient()

  // Fetch main incident with related entities
  const { data: incident, error } = await supabase
    .from('incidents')
    .select(`
      *,
      vehicles(id, vehicle_identifier, make, model, registration, plate_number),
      routes(id, route_number),
      route_sessions(
        id,
        session_date,
        session_type,
        driver_id,
        passenger_assistant_id,
        routes(route_number)
      ),
      created_by_user:created_by(id, email, role)
    `)
    .eq('id', id)
    .single()

  if (error || !incident) return null

  // Fetch related employees with driver/PA info
  const { data: relatedEmployees } = await supabase
    .from('incident_employees')
    .select('*, employees(id, full_name, role)')
    .eq('incident_id', id)

  // Fetch related passengers
  const { data: relatedPassengers } = await supabase
    .from('incident_passengers')
    .select('*, passengers(id, full_name, schools(name))')
    .eq('incident_id', id)

  // Fetch party entries (each related employee's detailed view)
  const { data: partyEntries } = await supabase
    .from('incident_party_entries')
    .select('*, employees(id, full_name, role)')
    .eq('incident_id', id)

  // Get driver and PA TAS numbers from route session or route
  let driverInfo = null
  let paInfo = null

  const routeSessions = incident.route_sessions
  if (routeSessions) {
    const session = Array.isArray(routeSessions) ? routeSessions[0] : routeSessions

    if (session.driver_id) {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('tas_badge_number, employees(full_name)')
        .eq('employee_id', session.driver_id)
        .maybeSingle()

      if (driverData) {
        driverInfo = {
          name: (driverData.employees as any)?.full_name || null,
          tasNumber: driverData.tas_badge_number || null,
        }
      }
    }

    if (session.passenger_assistant_id) {
      const { data: paData } = await supabase
        .from('passenger_assistants')
        .select('tas_badge_number, employees(full_name)')
        .eq('employee_id', session.passenger_assistant_id)
        .maybeSingle()

      if (paData) {
        paInfo = {
          name: (paData.employees as any)?.full_name || null,
          tasNumber: paData.tas_badge_number || null,
        }
      }
    }
  } else if (incident.routes) {
    // Try to get from route directly
    const { data: routeData } = await supabase
      .from('routes')
      .select(`
        driver_id,
        passenger_assistant_id,
        driver:driver_id(drivers(tas_badge_number), employees(full_name)),
        pa:passenger_assistant_id(passenger_assistants(tas_badge_number), employees(full_name))
      `)
      .eq('id', incident.routes.id)
      .maybeSingle()

    if (routeData) {
      if (routeData.driver) {
        const driver = routeData.driver as any
        driverInfo = {
          name: driver.employees?.full_name || null,
          tasNumber: driver.drivers?.tas_badge_number || null,
        }
      }
      if (routeData.pa) {
        const pa = routeData.pa as any
        paInfo = {
          name: pa.employees?.full_name || null,
          tasNumber: pa.passenger_assistants?.tas_badge_number || null,
        }
      }
    }
  }

  // If still no driver/PA info, try from incident employees
  if (!driverInfo || !paInfo) {
    if (relatedEmployees && relatedEmployees.length > 0) {
      for (const emp of relatedEmployees) {
        if (emp.employees?.role === 'Driver' && !driverInfo) {
          const { data: driverData } = await supabase
            .from('drivers')
            .select('tas_badge_number')
            .eq('employee_id', emp.employees.id)
            .maybeSingle()

          if (driverData) {
            driverInfo = {
              name: emp.employees.full_name,
              tasNumber: driverData.tas_badge_number || null,
            }
          }
        } else if (emp.employees?.role === 'PA' && !paInfo) {
          const { data: paData } = await supabase
            .from('passenger_assistants')
            .select('tas_badge_number')
            .eq('employee_id', emp.employees.id)
            .maybeSingle()

          if (paData) {
            paInfo = {
              name: emp.employees.full_name,
              tasNumber: paData.tas_badge_number || null,
            }
          }
        }
      }
    }
  }

  return {
    ...incident,
    incident_employees: relatedEmployees || [],
    incident_passengers: relatedPassengers || [],
    incident_party_entries: partyEntries || [],
    driverInfo,
    paInfo,
  }
}

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: userData } = await supabase
    .from('users')
    .select('id, role')
    .eq('email', authUser.email)
    .maybeSingle()

  return userData
}

export default async function ViewIncidentPage({ params }: { params: { id: string } }) {
  const incident = await getIncident(params.id)
  if (!incident) notFound()

  const currentUser = await getCurrentUser()
  const canEdit = currentUser && incident.created_by === currentUser.id
  const canDelete = currentUser && currentUser.role === 'super_admin'

  return (
    <div className="space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/incidents">
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Incident #{incident.id}</h1>
            <p className="text-sm text-slate-500">Incident Details & Related Entities</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IncidentToggleButton incidentId={incident.id} initialResolved={incident.resolved} />
          {canEdit && (
            <Link href={`/dashboard/incidents/${incident.id}/edit`}>
              <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
                Edit
              </Button>
            </Link>
          )}
          {canDelete && (
            <Link href={`/dashboard/incidents/${incident.id}/delete`}>
              <Button className="bg-red-600 text-white hover:bg-red-700">
                Delete
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4"><CardTitle className="text-sm font-semibold text-slate-700">Incident Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Incident ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{incident.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Type</dt>
              <dd className="mt-1 text-sm text-gray-900 font-semibold">{incident.incident_type || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${incident.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                  {incident.resolved ? 'Resolved' : 'Open'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Reported At</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDateTime(incident.reported_at)}</dd>
            </div>
            {incident.created_by_user && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Created By</dt>
                <dd className="mt-1 text-sm text-gray-900">{incident.created_by_user.email}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center">
              <Car className="mr-2 h-4 w-4" />
              Vehicle & Route
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Vehicle</dt>
              <dd className="mt-1">
                {incident.vehicles ? (
                  <Link href={`/dashboard/vehicles/${incident.vehicles.id}`} className="text-navy hover:underline inline-flex items-center">
                    {incident.vehicles.vehicle_identifier || `${incident.vehicles.make} ${incident.vehicles.model}`}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                ) : (
                  <span className="text-sm text-gray-500">N/A</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Route</dt>
              <dd className="mt-1">
                {incident.routes ? (
                  <Link href={`/dashboard/routes/${incident.routes.id}`} className="text-navy hover:underline inline-flex items-center">
                    <MapPin className="mr-1 h-3 w-3" />
                    {incident.routes.route_number || `Route ${incident.routes.id}`}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                ) : (
                  <span className="text-sm text-gray-500">N/A</span>
                )}
              </dd>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4"><CardTitle className="text-sm font-semibold text-slate-700">Description</CardTitle></CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{incident.description || 'No description provided.'}</p>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Related Employees */}
        <Card>
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center">
              <UserCog className="mr-2 h-4 w-4" />
              Related Employees ({incident.incident_employees?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {incident.incident_employees && incident.incident_employees.length > 0 ? (
              <div className="space-y-3">
                {incident.incident_employees.map((ie: any) => (
                  <div key={ie.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ie.employees?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{ie.employees?.role || 'No role specified'}</p>
                    </div>
                    <Link href={`/dashboard/employees/${ie.employees?.id}`}>
                      <Button variant="ghost" size="sm" className="text-navy">
                        View Profile
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No employees associated with this incident.</p>
            )}
          </CardContent>
        </Card>

        {/* Related Passengers */}
        <Card>
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center">
              <Users className="mr-2 h-4 w-4" />
              Related Passengers ({incident.incident_passengers?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {incident.incident_passengers && incident.incident_passengers.length > 0 ? (
              <div className="space-y-3">
                {incident.incident_passengers.map((ip: any) => (
                  <div key={ip.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ip.passengers?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{ip.passengers?.schools?.name || 'No school assigned'}</p>
                    </div>
                    <Link href={`/dashboard/passengers/${ip.passengers?.id}`}>
                      <Button variant="ghost" size="sm" className="text-navy">
                        View Profile
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No passengers associated with this incident.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Party accounts: each related employee (driver, PA) can have a detailed view */}
      {incident.incident_employees?.length > 0 && (
        <IncidentPartyEntries
          incidentId={incident.id}
          relatedEmployees={incident.incident_employees}
          initialEntries={incident.incident_party_entries ?? []}
        />
      )}

      {/* Incident Report Forms (TR5, TR6, TR7) */}
      <div id="incident-report-forms">
        <IncidentReportForms
          incident={incident}
          driverInfo={incident.driverInfo}
          paInfo={incident.paInfo}
        />
      </div>

      {/* Incident Documents */}
      <IncidentDocuments incidentId={incident.id} />
    </div>
  )
}

