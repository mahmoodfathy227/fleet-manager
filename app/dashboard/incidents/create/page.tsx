'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { ArrowLeft, Users, UserCog, AlertCircle, Calendar, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import IncidentReportForms from '../[id]/IncidentReportForms'

export default function CreateIncidentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [passengers, setPassengers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])

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
  const [routeSessions, setRouteSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [createdIncidentId, setCreatedIncidentId] = useState<number | null>(null)
  const [formIncident, setFormIncident] = useState<any>(null)

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const togglePassenger = (passengerId: number) => {
    setSelectedPassengers(prev =>
      prev.includes(passengerId)
        ? prev.filter(id => id !== passengerId)
        : [...prev, passengerId]
    )
  }

  // Load vehicles and routes for dropdowns only
  useEffect(() => {
    async function loadDropdowns() {
      const [vehiclesResult, routesResult] = await Promise.all([
        supabase.from('vehicles').select('id, vehicle_identifier').order('vehicle_identifier'),
        supabase.from('routes').select('id, route_number').order('route_number')
      ])
      if (vehiclesResult.data) setVehicles(vehiclesResult.data)
      if (routesResult.data) setRoutes(routesResult.data)
    }
    loadDropdowns()
  }, [supabase])

  // When a route is selected (from session or dropdown), load crew + coordinators and passengers on this route only
  useEffect(() => {
    if (!formData.route_id) {
      setEmployees([])
      setPassengers([])
      setSelectedEmployees([])
      setSelectedPassengers([])
      return
    }

    const routeId = parseInt(formData.route_id)
    if (isNaN(routeId)) return

    let cancelled = false
    async function loadRouteCrewAndPassengers() {
      const { data: route, error: routeErr } = await supabase
        .from('routes')
        .select('id, school_id, driver_id, passenger_assistant_id')
        .eq('id', routeId)
        .single()

      if (routeErr || !route || cancelled) return

      const crewIds = new Set<number>()
      if (route.driver_id) crewIds.add(route.driver_id)
      if (route.passenger_assistant_id) crewIds.add(route.passenger_assistant_id)

      const { data: routePas } = await supabase
        .from('route_passenger_assistants')
        .select('employee_id')
        .eq('route_id', routeId)
      routePas?.forEach((r: { employee_id: number }) => crewIds.add(r.employee_id))

      const coordinatorIds = new Set<number>()
      if (route.school_id) {
        const { data: coordAssignments } = await supabase
          .from('coordinator_school_assignments')
          .select('employee_id')
          .eq('school_id', route.school_id)
        coordAssignments?.forEach((c: { employee_id: number }) => coordinatorIds.add(c.employee_id))
      }

      const combinedIds = Array.from(crewIds).concat(Array.from(coordinatorIds))
      const uniqueEmployeeIds = Array.from(new Set(combinedIds))
      const { data: employeeRows } = await supabase
        .from('employees')
        .select('id, full_name')
        .in('id', uniqueEmployeeIds)
        .order('full_name')

      const { data: passengerRows } = await supabase
        .from('passengers')
        .select('id, full_name, schools(name)')
        .eq('route_id', routeId)
        .order('full_name')

      if (cancelled) return
      if (employeeRows) {
        setEmployees(employeeRows)
        setSelectedEmployees(prev => prev.filter(id => employeeRows.some((e: any) => e.id === id)))
      } else {
        setEmployees([])
        setSelectedEmployees([])
      }
      if (passengerRows) {
        setPassengers(passengerRows)
        setSelectedPassengers(prev => prev.filter(id => passengerRows.some((p: any) => p.id === id)))
      } else {
        setPassengers([])
        setSelectedPassengers([])
      }
    }

    loadRouteCrewAndPassengers()
    return () => { cancelled = true }
  }, [formData.route_id])

  useEffect(() => {
    const sessionId = searchParams?.get('route_session_id')
    if (sessionId) {
      setFormData(prev => ({ ...prev, route_session_id: sessionId }))
      loadRouteSessions()
    }
  }, [searchParams])

  useEffect(() => {
    if (formData.route_session_id) {
      loadRouteSessionDetails(parseInt(formData.route_session_id))
    }
  }, [formData.route_session_id])

  // After incident is created, load enriched incident for TR5/TR6/TR7 forms
  useEffect(() => {
    if (!createdIncidentId) {
      setFormIncident(null)
      return
    }
    const id = createdIncidentId.toString()
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
  }, [createdIncidentId, supabase])

  const loadRouteSessions = async () => {
    setLoadingSessions(true)
    const { data, error } = await supabase
      .from('route_sessions')
      .select(`
        id,
        session_date,
        session_type,
        route_id,
        driver_id,
        passenger_assistant_id,
        routes(route_number)
      `)
      .order('session_date', { ascending: false })
      .order('session_type', { ascending: true })
      .limit(100)

    if (!error && data) {
      setRouteSessions(data.map((s: any) => ({
        id: s.id,
        label: `${formatDate(s.session_date)} - ${s.session_type} (${s.routes?.route_number || `Route ${s.route_id}`})`,
        route_id: s.route_id,
        driver_id: s.driver_id,
        passenger_assistant_id: s.passenger_assistant_id,
      })))
    }
    setLoadingSessions(false)
  }

  const loadRouteSessionDetails = async (sessionId: number) => {
    const { data, error } = await supabase
      .from('route_sessions')
      .select(`
        id,
        route_id,
        driver_id,
        passenger_assistant_id,
        routes(route_number)
      `)
      .eq('id', sessionId)
      .single()

    if (!error && data) {
      setFormData(prev => ({
        ...prev,
        route_id: data.route_id.toString(),
      }))

      const newEmployees = [...selectedEmployees]
      if (data.driver_id && !newEmployees.includes(data.driver_id)) {
        newEmployees.push(data.driver_id)
      }
      if (data.passenger_assistant_id && !newEmployees.includes(data.passenger_assistant_id)) {
        newEmployees.push(data.passenger_assistant_id)
      }
      setSelectedEmployees(newEmployees)

      if (data.driver_id) {
        const { data: vehicleData } = await supabase
          .from('vehicle_assignments')
          .select('vehicle_id')
          .eq('employee_id', data.driver_id)
          .maybeSingle()

        if (vehicleData?.vehicle_id) {
          setFormData(prev => ({
            ...prev,
            vehicle_id: vehicleData.vehicle_id.toString(),
          }))
        }
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        throw new Error('You must be logged in to create an incident')
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()

      const incidentDataToInsert = {
        ...formData,
        created_by: userData?.id || null,
      }

      const { data: incidentData, error: incidentError } = await supabase
        .from('incidents')
        .insert([incidentDataToInsert])
        .select()
        .single()

      if (incidentError) throw incidentError

      const incidentId = incidentData.id

      if (formData.route_session_id) {
        await supabase
          .from('incidents')
          .update({ route_session_id: parseInt(formData.route_session_id) })
          .eq('id', incidentId)
      }

      if (selectedEmployees.length > 0) {
        const employeeLinks = selectedEmployees.map(employeeId => ({
          incident_id: incidentId,
          employee_id: employeeId,
        }))

        const { error: employeesError } = await supabase
          .from('incident_employees')
          .insert(employeeLinks)

        if (employeesError) {
          console.error('Error linking employees:', employeesError)
        }
      }

      if (selectedPassengers.length > 0) {
        const passengerLinks = selectedPassengers.map(passengerId => ({
          incident_id: incidentId,
          passenger_id: passengerId,
        }))

        const { error: passengersError } = await supabase
          .from('incident_passengers')
          .insert(passengerLinks)

        if (passengersError) {
          console.error('Error linking passengers:', passengersError)
        }
      }

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'incidents',
          record_id: incidentId,
          action: 'CREATE',
        }),
      })

      setCreatedIncidentId(incidentId)
    } catch (error: any) {
      console.error('Error creating incident:', error)
      setError(error.message || 'An error occurred while creating the incident')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/incidents">
          <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {createdIncidentId ? 'Incident created' : 'Report New Incident'}
          </h1>
          <p className="text-sm text-slate-500">
            {createdIncidentId ? 'Complete the report forms below or view the incident.' : 'Fill in the details and select involved parties'}
          </p>
        </div>
      </div>

      {createdIncidentId && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-800 text-sm">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span>Incident #{createdIncidentId} created. Complete TR5/TR6/TR7 forms below or view the incident.</span>
          </div>
          <Link href={`/dashboard/incidents/${createdIncidentId}`}>
            <Button variant="outline" size="sm" className="border-green-300 text-green-800 hover:bg-green-100">
              View incident
            </Button>
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {!createdIncidentId && formData.route_session_id && (
        <div className="rounded-lg bg-violet-50 border border-violet-200 p-2.5 text-sm text-violet-800">
          <strong>Route session pre-selected.</strong> Route, vehicle and crew will be auto-filled.
        </div>
      )}

      {!createdIncidentId && (
      <>
      {/* Main Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Incident Details Section */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700">Incident Details</h2>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {/* Row 1: Type + Route Session */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="incident_type" className="text-xs font-medium text-slate-600">Incident Type *</Label>
                <Select
                  id="incident_type"
                  required
                  value={formData.incident_type}
                  onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
                  className="h-9"
                >
                  <option value="">Select type</option>
                  <option value="Accident">Accident</option>
                  <option value="Breakdown">Breakdown</option>
                  <option value="Complaint">Complaint</option>
                  <option value="Safety Issue">Safety Issue</option>
                  <option value="Other">Other</option>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="route_session_id" className="text-xs font-medium text-slate-600">
                    <Calendar className="inline mr-1 h-3 w-3" />
                    Route Session
                  </Label>
                  {routeSessions.length === 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={loadRouteSessions} disabled={loadingSessions} className="h-6 text-xs px-2">
                      {loadingSessions ? 'Loading...' : 'Load Sessions'}
                    </Button>
                  )}
                </div>
                <Select
                  id="route_session_id"
                  value={formData.route_session_id}
                  onChange={(e) => setFormData({ ...formData, route_session_id: e.target.value })}
                  className="h-9"
                >
                  <option value="">Select session (optional)</option>
                  {routeSessions.map((session) => (
                    <option key={session.id} value={session.id}>{session.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Row 2: Vehicle + Route */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="vehicle_id" className="text-xs font-medium text-slate-600">
                  Vehicle {formData.route_session_id && <span className="text-slate-400">(Auto-filled)</span>}
                </Label>
                <Select id="vehicle_id" value={formData.vehicle_id} onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })} className="h-9">
                  <option value="">Select vehicle</option>
                  {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_identifier || `Vehicle ${vehicle.id}`}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="route_id" className="text-xs font-medium text-slate-600">
                  Related Route {formData.route_session_id && <span className="text-slate-400">(Auto-filled)</span>}
                </Label>
                <Select id="route_id" value={formData.route_id} onChange={(e) => setFormData({ ...formData, route_id: e.target.value })} className="h-9">
                  <option value="">Select route</option>
                  {routes.map((route) => <option key={route.id} value={route.id}>{route.route_number || `Route ${route.id}`}</option>)}
                </Select>
              </div>
            </div>

            {/* Row 3: Description */}
            <div className="space-y-1">
              <Label htmlFor="description" className="text-xs font-medium text-slate-600">Description *</Label>
              <textarea
                id="description"
                required
                rows={3}
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023E8A] focus:border-transparent"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the incident..."
              />
            </div>

            {/* Row 4: Resolved checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="resolved"
                checked={formData.resolved}
                onChange={(e) => setFormData({ ...formData, resolved: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]"
              />
              <Label htmlFor="resolved" className="text-sm text-slate-600">Mark as Resolved</Label>
            </div>
          </div>
        </div>

        {/* Related Employees Section — crew (driver, PAs) + coordinators for selected route only */}
        <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <UserCog className="mr-2 h-4 w-4" />
            Related Employees ({selectedEmployees.length} selected)
          </h2>
          {!formData.route_id && (
            <p className="text-xs text-slate-500 mt-0.5">Select a route or route session to choose from crew and coordinators on that route.</p>
          )}
        </div>
        <div className="p-4">
          {!formData.route_id ? (
            <p className="text-sm text-slate-500 italic">Select a route or route session above to see crew and coordinators.</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No crew or coordinators for this route.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4 max-h-48 overflow-y-auto">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${selectedEmployees.includes(employee.id)
                    ? 'border-[#023E8A] bg-blue-50'
                    : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  onClick={() => toggleEmployee(employee.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(employee.id)}
                    onChange={() => toggleEmployee(employee.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]"
                  />
                  <span className="ml-2 text-sm text-slate-700 truncate">{employee.full_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related Passengers Section — passengers on selected route only */}
        <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Related Passengers ({selectedPassengers.length} selected)
          </h2>
          {!formData.route_id && (
            <p className="text-xs text-slate-500 mt-0.5">Select a route or route session to choose from passengers on that route.</p>
          )}
        </div>
        <div className="p-4">
          {!formData.route_id ? (
            <p className="text-sm text-slate-500 italic">Select a route or route session above to see passengers.</p>
          ) : passengers.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No passengers on this route.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4 max-h-48 overflow-y-auto">
              {passengers.map((passenger: any) => (
                <div
                  key={passenger.id}
                  className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${selectedPassengers.includes(passenger.id)
                    ? 'border-[#023E8A] bg-blue-50'
                    : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  onClick={() => togglePassenger(passenger.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedPassengers.includes(passenger.id)}
                    onChange={() => togglePassenger(passenger.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]"
                  />
                  <div className="ml-2 flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{passenger.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">{passenger.schools?.name || 'No school'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
        <Link href="/dashboard/incidents">
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
            Cancel
          </Button>
        </Link>
        <Button onClick={handleSubmit} disabled={loading} className="bg-[#023E8A] hover:bg-[#023E8A]/90 text-white">
          {loading ? 'Submitting...' : 'Submit Report'}
        </Button>
      </div>
      </>
      )}

      {/* Incident Report Forms (TR5, TR6, TR7) - shown after create */}
      {formIncident && (
        <IncidentReportForms
          incident={formIncident}
          driverInfo={formIncident.driverInfo ?? undefined}
          paInfo={formIncident.paInfo ?? undefined}
        />
      )}
    </div>
  )
}
