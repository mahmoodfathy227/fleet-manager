'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { ArrowLeft, AlertCircle, UserCog, Users, FileText, Car } from 'lucide-react'
import Link from 'next/link'
import IncidentReportForms from '../IncidentReportForms'

export default function EditIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [checkingPermissions, setCheckingPermissions] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [incident, setIncident] = useState<any>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [passengers, setPassengers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [routeSessions, setRouteSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  const [formData, setFormData] = useState({
    vehicle_id: '',
    route_id: '',
    route_session_id: '',
    incident_type: '',
    description: '',
    resolved: false,
  })

  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([])
  const [selectedPassengers, setSelectedPassengers] = useState<number[]>([])
  const [formIncident, setFormIncident] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      const { id } = await params

      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setUnauthorized(true)
        setCheckingPermissions(false)
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', authUser.email)
        .maybeSingle()

      if (!userData) {
        setUnauthorized(true)
        setCheckingPermissions(false)
        return
      }

      const { data: incidentData, error: incidentError } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', id)
        .single()

      if (incidentError || !incidentData) {
        setError('Incident not found')
        setCheckingPermissions(false)
        return
      }

      if (incidentData.created_by !== userData.id) {
        setUnauthorized(true)
        setCheckingPermissions(false)
        return
      }

      setIncident(incidentData)
      setFormData({
        vehicle_id: incidentData.vehicle_id?.toString() || '',
        route_id: incidentData.route_id?.toString() || '',
        route_session_id: incidentData.route_session_id?.toString() || '',
        incident_type: incidentData.incident_type || '',
        description: incidentData.description || '',
        resolved: incidentData.resolved || false,
      })

      const [employeesResult, passengersResult, vehiclesResult, routesResult, employeesLinks, passengersLinks] = await Promise.all([
        supabase.from('employees').select('id, full_name').order('full_name'),
        supabase.from('passengers').select('id, full_name').order('full_name'),
        supabase.from('vehicles').select('id, vehicle_identifier, make, model').order('vehicle_identifier'),
        supabase.from('routes').select('id, route_number').order('route_number'),
        supabase.from('incident_employees').select('employee_id').eq('incident_id', id),
        supabase.from('incident_passengers').select('passenger_id').eq('incident_id', id),
      ])

      if (employeesResult.data) setEmployees(employeesResult.data)
      if (passengersResult.data) setPassengers(passengersResult.data)
      if (vehiclesResult.data) setVehicles(vehiclesResult.data)
      if (routesResult.data) setRoutes(routesResult.data)
      if (employeesLinks.data) setSelectedEmployees(employeesLinks.data.map((e: any) => e.employee_id))
      if (passengersLinks.data) setSelectedPassengers(passengersLinks.data.map((p: any) => p.passenger_id))

      setCheckingPermissions(false)
    }

    loadData()
  }, [params, supabase])

  // Load enriched incident for TR5/TR6/TR7 forms (same shape as view page)
  useEffect(() => {
    if (!incident?.id) {
      setFormIncident(null)
      return
    }
    const id = incident.id.toString()
    let cancelled = false
    async function loadFormIncident() {
      const { data: inc, error: incErr } = await supabase
        .from('incidents')
        .select(`
          *,
          vehicles(id, vehicle_identifier, make, model, registration, plate_number),
          routes(id, route_number),
          route_sessions(id, session_date, session_type, driver_id, passenger_assistant_id, routes(route_number))
        `)
        .eq('id', id)
        .single()
      if (incErr || !inc || cancelled) return

      const { data: relatedEmployees } = await supabase
        .from('incident_employees')
        .select('*, employees(id, full_name, role)')
        .eq('incident_id', id)
      const { data: relatedPassengers } = await supabase
        .from('incident_passengers')
        .select('*, passengers(id, full_name, schools(name))')
        .eq('incident_id', id)

      let driverInfo: { name: string | null; tasNumber: string | null } | null = null
      let paInfo: { name: string | null; tasNumber: string | null } | null = null
      const session = Array.isArray(inc.route_sessions) ? inc.route_sessions[0] : inc.route_sessions
      if (session?.driver_id) {
        const { data: d } = await supabase.from('drivers').select('tas_badge_number, employees(full_name)').eq('employee_id', session.driver_id).maybeSingle()
        if (d) driverInfo = { name: (d as any).employees?.full_name ?? null, tasNumber: (d as any).tas_badge_number ?? null }
      }
      if (session?.passenger_assistant_id) {
        const { data: p } = await supabase.from('passenger_assistants').select('tas_badge_number, employees(full_name)').eq('employee_id', session.passenger_assistant_id).maybeSingle()
        if (p) paInfo = { name: (p as any).employees?.full_name ?? null, tasNumber: (p as any).tas_badge_number ?? null }
      }
      if (!driverInfo || !paInfo) {
        const route = Array.isArray(inc.routes) ? inc.routes[0] : inc.routes
        if (route?.id) {
          const { data: r } = await supabase.from('routes').select('driver_id, passenger_assistant_id, driver:driver_id(drivers(tas_badge_number), employees(full_name)), pa:passenger_assistant_id(passenger_assistants(tas_badge_number), employees(full_name))').eq('id', route.id).maybeSingle()
          if (r) {
            const dr = (r as any).driver
            const pa = (r as any).pa
            if (!driverInfo && dr) driverInfo = { name: dr.employees?.full_name ?? null, tasNumber: dr.drivers?.tas_badge_number ?? null }
            if (!paInfo && pa) paInfo = { name: pa.employees?.full_name ?? null, tasNumber: pa.passenger_assistants?.tas_badge_number ?? null }
          }
        }
      }

      if (cancelled) return
      setFormIncident({
        ...inc,
        incident_employees: relatedEmployees ?? [],
        incident_passengers: relatedPassengers ?? [],
        driverInfo: driverInfo ?? null,
        paInfo: paInfo ?? null,
      })
    }
    loadFormIncident()
    return () => { cancelled = true }
  }, [incident?.id, supabase])

  const loadRouteSessions = async (routeId: number) => {
    setLoadingSessions(true)
    const { data } = await supabase
      .from('route_sessions')
      .select(`id, session_date, session_type, routes(route_number)`)
      .eq('route_id', routeId)
      .order('session_date', { ascending: false })
      .order('session_type', { ascending: true })

    if (data) {
      setRouteSessions(data.map((s: any) => ({
        id: s.id,
        session_date: s.session_date,
        session_type: s.session_type,
        route_name: s.routes?.route_number || null,
      })))
    }
    setLoadingSessions(false)
  }

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId) ? prev.filter(id => id !== employeeId) : [...prev, employeeId]
    )
  }

  const togglePassenger = (passengerId: number) => {
    setSelectedPassengers(prev =>
      prev.includes(passengerId) ? prev.filter(id => id !== passengerId) : [...prev, passengerId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { id } = await params

      const { error: updateError } = await supabase
        .from('incidents')
        .update({
          vehicle_id: formData.vehicle_id ? parseInt(formData.vehicle_id) : null,
          route_id: formData.route_id ? parseInt(formData.route_id) : null,
          route_session_id: formData.route_session_id ? parseInt(formData.route_session_id) : null,
          incident_type: formData.incident_type,
          description: formData.description,
          resolved: formData.resolved,
        })
        .eq('id', id)

      if (updateError) throw updateError

      await supabase.from('incident_employees').delete().eq('incident_id', id)
      if (selectedEmployees.length > 0) {
        const employeeLinks = selectedEmployees.map(employeeId => ({
          incident_id: parseInt(id),
          employee_id: employeeId,
        }))
        await supabase.from('incident_employees').insert(employeeLinks)
      }

      await supabase.from('incident_passengers').delete().eq('incident_id', id)
      if (selectedPassengers.length > 0) {
        const passengerLinks = selectedPassengers.map(passengerId => ({
          incident_id: parseInt(id),
          passenger_id: passengerId,
        }))
        await supabase.from('incident_passengers').insert(passengerLinks)
      }

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'incidents', record_id: parseInt(id), action: 'UPDATE' }),
      }).catch(err => console.error('Audit log error:', err))

      router.push(`/dashboard/incidents/${id}`)
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (checkingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500">Checking permissions...</p>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/incidents">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-slate-600 text-sm">You can only edit incidents that you created.</p>
        </div>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500">Incident not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/incidents/${incident.id}`}>
          <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Edit Incident #{incident.id}</h1>
          <p className="text-sm text-slate-500">Update incident information</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Incident Details Section */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <FileText className="mr-2 h-4 w-4" />
            Incident Details
          </h2>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="incident_type" className="text-xs font-medium text-slate-600">Incident Type *</Label>
                <Input id="incident_type" required value={formData.incident_type} onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="resolved" className="text-xs font-medium text-slate-600">Status</Label>
                <Select id="resolved" value={formData.resolved ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, resolved: e.target.value === 'true' })} className="h-9">
                  <option value="false">Open</option>
                  <option value="true">Resolved</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description" className="text-xs font-medium text-slate-600">Description *</Label>
              <textarea
                id="description"
                required
                rows={3}
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023E8A] focus:border-transparent"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Vehicle & Route Section */}
        <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <Car className="mr-2 h-4 w-4" />
            Vehicle & Route
          </h2>
        </div>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="vehicle_id" className="text-xs font-medium text-slate-600">Vehicle</Label>
              <Select id="vehicle_id" value={formData.vehicle_id} onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })} className="h-9">
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_identifier || `${vehicle.make} ${vehicle.model}`}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="route_id" className="text-xs font-medium text-slate-600">Route</Label>
              <Select
                id="route_id"
                value={formData.route_id}
                onChange={(e) => {
                  setFormData({ ...formData, route_id: e.target.value, route_session_id: '' })
                  if (e.target.value) loadRouteSessions(parseInt(e.target.value))
                  else setRouteSessions([])
                }}
                className="h-9"
              >
                <option value="">Select route</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>{route.route_number || `Route ${route.id}`}</option>
                ))}
              </Select>
            </div>
            {formData.route_id && (
              <div className="space-y-1">
                <Label htmlFor="route_session_id" className="text-xs font-medium text-slate-600">Route Session</Label>
                <Select id="route_session_id" value={formData.route_session_id} onChange={(e) => setFormData({ ...formData, route_session_id: e.target.value })} disabled={loadingSessions} className="h-9">
                  <option value="">Select session (optional)</option>
                  {routeSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.route_name} - {session.session_date} ({session.session_type})
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Related Employees Section */}
        <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <UserCog className="mr-2 h-4 w-4" />
            Related Employees ({selectedEmployees.length} selected)
          </h2>
        </div>
        <div className="p-4">
          {employees.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No employees available</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-5 max-h-40 overflow-y-auto">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${selectedEmployees.includes(employee.id) ? 'border-[#023E8A] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => toggleEmployee(employee.id)}
                >
                  <input type="checkbox" checked={selectedEmployees.includes(employee.id)} onChange={() => toggleEmployee(employee.id)} className="h-3.5 w-3.5 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]" />
                  <span className="ml-2 text-sm text-slate-700 truncate">{employee.full_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related Passengers Section */}
        <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Related Passengers ({selectedPassengers.length} selected)
          </h2>
        </div>
        <div className="p-4">
          {passengers.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No passengers available</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-5 max-h-40 overflow-y-auto">
              {passengers.map((passenger) => (
                <div
                  key={passenger.id}
                  className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${selectedPassengers.includes(passenger.id) ? 'border-[#023E8A] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => togglePassenger(passenger.id)}
                >
                  <input type="checkbox" checked={selectedPassengers.includes(passenger.id)} onChange={() => togglePassenger(passenger.id)} className="h-3.5 w-3.5 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]" />
                  <span className="ml-2 text-sm text-slate-700 truncate">{passenger.full_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Incident Report Forms (TR5, TR6, TR7) */}
      {formIncident && (
        <IncidentReportForms
          incident={formIncident}
          driverInfo={formIncident.driverInfo ?? undefined}
          paInfo={formIncident.paInfo ?? undefined}
        />
      )}

      {/* Bottom Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
        <Link href={`/dashboard/incidents/${incident.id}`}>
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
            Cancel
          </Button>
        </Link>
        <Button onClick={handleSubmit} disabled={loading} className="bg-[#023E8A] hover:bg-[#023E8A]/90 text-white">
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
