'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { ArrowLeft, Users, UserCog, AlertCircle, CheckCircle, FileText, Car } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import IncidentReportForms, { type IncidentReportFormsHandle } from '@/app/dashboard/incidents/[id]/IncidentReportForms'

async function persistTrDocuments(
  sb: ReturnType<typeof createClient>,
  opts: {
    incidentId: number
    userId: string | null
    tr5: Record<string, unknown> | null
    tr6: Record<string, unknown> | null
    tr7: Record<string, unknown> | null
  }
) {
  const day = new Date().toISOString().split('T')[0]
  const rows: { docType: string; payload: Record<string, unknown> }[] = [
    { docType: 'TR5 Form', payload: opts.tr5 ?? {} },
    { docType: 'TR6 Form', payload: opts.tr6 ?? {} },
    { docType: 'TR7 Form', payload: opts.tr7 ?? {} },
  ]
  for (const { docType, payload } of rows) {
    const formDataJson = JSON.stringify(payload)
    const fileName = `${docType.replace(/ /g, '')}_Incident_${opts.incidentId}_${day}.json`
    const { error } = await sb.from('documents').insert({
      owner_type: 'incident',
      owner_id: opts.incidentId,
      doc_type: docType,
      file_name: fileName,
      file_type: 'application/json',
      file_url: formDataJson,
      file_path: fileName,
      uploaded_by: opts.userId,
    })
    if (error) console.error('[persistTrDocuments]', docType, error)
  }
  console.debug('[persistTrDocuments] inserted TR rows', { incidentId: opts.incidentId })
}

type PickOption = { id: number; label: string }

function vehicleLabel(v: { id: number; vehicle_identifier?: string | null; make?: string | null; model?: string | null }) {
  const fromId = v.vehicle_identifier || [v.make, v.model].filter(Boolean).join(' ').trim()
  return fromId || `Vehicle #${v.id}`
}

/** Single-select with type-to-filter list (vehicle, route, session). */
function SearchablePickOne({
  inputId,
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  inputId: string
  label: string
  value: string
  onChange: (nextId: string) => void
  options: PickOption[]
  disabled?: boolean
  placeholder?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const selectedLabel = useMemo(() => {
    if (!value) return ''
    const n = Number(value)
    return options.find((o) => o.id === n)?.label ?? ''
  }, [value, options])

  useEffect(() => {
    if (!open) setText(selectedLabel)
  }, [selectedLabel, open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, text])

  const pick = (opt: PickOption) => {
    onChange(String(opt.id))
    setText(opt.label)
    setOpen(false)
    console.debug('[SearchablePickOne] selected', { inputId, id: opt.id })
  }

  const clear = () => {
    onChange('')
    setText('')
    setOpen(false)
    console.debug('[SearchablePickOne] cleared', { inputId })
  }

  return (
    <div className="space-y-1" ref={wrapRef}>
      <Label htmlFor={inputId} className="text-xs font-medium text-slate-600">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={inputId}
          disabled={disabled}
          value={open ? text : selectedLabel || text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setText(selectedLabel)
          }}
          placeholder={placeholder}
          className="h-9"
          autoComplete="off"
        />
        {open && !disabled && (
          <ul
            className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
            role="listbox"
          >
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-slate-500 hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => clear()}
              >
                Clear selection
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-slate-500">No matches</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-slate-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(opt)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function CreateIncidentPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
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
  const [reportFormsLoading, setReportFormsLoading] = useState(false)
  const [reportFormsError, setReportFormsError] = useState<string | null>(null)

  const [draftReportedAt] = useState(() => new Date().toISOString())
  const reportFormsDraftRef = useRef<IncidentReportFormsHandle>(null)

  useEffect(() => {
    console.debug(
      '[CreateIncidentPage] TR draft: each TR form gates Save/Export locally (removed draftSaveAllowed)'
    )
  }, [])

  const [employeeQuery, setEmployeeQuery] = useState('')
  const [passengerQuery, setPassengerQuery] = useState('')

  const vehicleOptions: PickOption[] = useMemo(
    () => vehicles.map((v) => ({ id: v.id, label: vehicleLabel(v) })),
    [vehicles]
  )
  const routeOptions: PickOption[] = useMemo(
    () => routes.map((r) => ({ id: r.id, label: r.route_number || `Route ${r.id}` })),
    [routes]
  )
  const sessionOptions: PickOption[] = useMemo(
    () =>
      routeSessions.map((s) => ({
        id: s.id,
        label: `${s.route_name ?? 'Route'} - ${s.session_date} (${s.session_type})`,
      })),
    [routeSessions]
  )

  const draftDriverPa = useMemo(() => {
    const sid = formData.route_session_id ? parseInt(formData.route_session_id, 10) : null
    const session = sid ? routeSessions.find((s) => s.id === sid) : null
    const driverEmpId = session?.driver_id ?? null
    const paEmpId = session?.passenger_assistant_id ?? null
    const driverName = driverEmpId ? employees.find((e) => e.id === driverEmpId)?.full_name ?? null : null
    const paName = paEmpId ? employees.find((e) => e.id === paEmpId)?.full_name ?? null : null
    return {
      driverInfo: { name: driverName, tasNumber: null as string | null },
      paInfo: { name: paName, tasNumber: null as string | null },
    }
  }, [formData.route_session_id, routeSessions, employees])

  const draftIncident = useMemo(() => {
    const vid = formData.vehicle_id ? parseInt(formData.vehicle_id, 10) : null
    const rid = formData.route_id ? parseInt(formData.route_id, 10) : null
    const sid = formData.route_session_id ? parseInt(formData.route_session_id, 10) : null
    const vehicle = vid ? vehicles.find((v) => v.id === vid) : null
    const route = rid ? routes.find((r) => r.id === rid) : null
    const session = sid ? routeSessions.find((s) => s.id === sid) : null

    return {
      id: 0,
      incident_type: formData.incident_type || null,
      description: formData.description || null,
      reported_at: draftReportedAt,
      location: null as string | null,
      vehicles: vehicle
        ? {
            id: vehicle.id,
            vehicle_identifier: vehicle.vehicle_identifier ?? null,
            registration: vehicle.registration ?? null,
            plate_number: vehicle.plate_number ?? null,
          }
        : null,
      routes: route ? { id: route.id, route_number: route.route_number ?? null } : null,
      route_sessions: session
        ? {
            id: session.id,
            session_date: session.session_date,
            session_type: session.session_type,
            driver_id: session.driver_id ?? null,
            passenger_assistant_id: session.passenger_assistant_id ?? null,
          }
        : null,
      incident_employees: selectedEmployees.map((eid) => {
        const e = employees.find((x) => x.id === eid)
        return { employees: e ? { id: e.id, full_name: e.full_name ?? null, role: null as string | null } : null }
      }),
      incident_passengers: selectedPassengers.map((pid) => {
        const p = passengers.find((x) => x.id === pid)
        return {
          passengers: p ? { id: p.id, full_name: p.full_name ?? null, schools: null as { name: string | null } | null } : null,
        }
      }),
    }
  }, [
    draftReportedAt,
    formData.incident_type,
    formData.description,
    formData.vehicle_id,
    formData.route_id,
    formData.route_session_id,
    vehicles,
    routes,
    routeSessions,
    selectedEmployees,
    selectedPassengers,
    employees,
    passengers,
  ])

  const filteredEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => (e.full_name || '').toLowerCase().includes(q))
  }, [employees, employeeQuery])

  const filteredPassengers = useMemo(() => {
    const q = passengerQuery.trim().toLowerCase()
    if (!q) return passengers
    return passengers.filter((p) => (p.full_name || '').toLowerCase().includes(q))
  }, [passengers, passengerQuery])

  useEffect(() => {
    console.debug('[CreateIncidentPage] mount: stable supabase client + searchable fields')
  }, [])

  useEffect(() => {
    async function loadDropdowns() {
      const [employeesResult, passengersResult, vehiclesResult, routesResult] = await Promise.all([
        supabase.from('employees').select('id, full_name').order('full_name'),
        supabase.from('passengers').select('id, full_name').order('full_name'),
        supabase.from('vehicles').select('id, vehicle_identifier, make, model, registration, plate_number').order('vehicle_identifier'),
        supabase.from('routes').select('id, route_number').order('route_number'),
      ])
      if (employeesResult.data) setEmployees(employeesResult.data)
      if (passengersResult.data) setPassengers(passengersResult.data)
      if (vehiclesResult.data) setVehicles(vehiclesResult.data)
      if (routesResult.data) setRoutes(routesResult.data)
    }
    void loadDropdowns()
  }, [supabase])

  const loadRouteSessions = async (routeId: number) => {
    setLoadingSessions(true)
    const { data } = await supabase
      .from('route_sessions')
      .select(`id, session_date, session_type, driver_id, passenger_assistant_id, routes(route_number)`)
      .eq('route_id', routeId)
      .order('session_date', { ascending: false })
      .order('session_type', { ascending: true })

    if (data) {
      setRouteSessions(
        data.map((s: any) => ({
          id: s.id,
          session_date: s.session_date,
          session_type: s.session_type,
          route_name: s.routes?.route_number || null,
          driver_id: s.driver_id ?? null,
          passenger_assistant_id: s.passenger_assistant_id ?? null,
        }))
      )
    } else {
      setRouteSessions([])
    }
    setLoadingSessions(false)
  }

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId]
    )
  }

  const togglePassenger = (passengerId: number) => {
    setSelectedPassengers((prev) =>
      prev.includes(passengerId) ? prev.filter((id) => id !== passengerId) : [...prev, passengerId]
    )
  }

  const loadFormIncident = useCallback(
    async (incidentId: number) => {
      const id = String(incidentId)
      const { data: inc, error: incErr } = await supabase
        .from('incidents')
        .select(
          `
          *,
          vehicles(id, vehicle_identifier, make, model, registration, plate_number),
          routes(id, route_number),
          route_sessions(id, session_date, session_type, driver_id, passenger_assistant_id, routes(route_number))
        `
        )
        .eq('id', id)
        .single()

      if (incErr || !inc) {
        console.debug('[CreateIncidentPage] loadFormIncident failed', { id, message: incErr?.message })
        return { ok: false as const, error: incErr?.message || 'Could not load incident for report forms' }
      }

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
        const { data: d } = await supabase
          .from('drivers')
          .select('tas_badge_number, employees(full_name)')
          .eq('employee_id', session.driver_id)
          .maybeSingle()
        if (d) driverInfo = { name: (d as any).employees?.full_name ?? null, tasNumber: (d as any).tas_badge_number ?? null }
      }
      if (session?.passenger_assistant_id) {
        const { data: p } = await supabase
          .from('passenger_assistants')
          .select('tas_badge_number, employees(full_name)')
          .eq('employee_id', session.passenger_assistant_id)
          .maybeSingle()
        if (p) paInfo = { name: (p as any).employees?.full_name ?? null, tasNumber: (p as any).tas_badge_number ?? null }
      }
      if (!driverInfo || !paInfo) {
        const route = Array.isArray(inc.routes) ? inc.routes[0] : inc.routes
        if (route?.id) {
          const { data: r } = await supabase
            .from('routes')
            .select(
              'driver_id, passenger_assistant_id, driver:driver_id(drivers(tas_badge_number), employees(full_name)), pa:passenger_assistant_id(passenger_assistants(tas_badge_number), employees(full_name))'
            )
            .eq('id', route.id)
            .maybeSingle()
          if (r) {
            const dr = (r as any).driver
            const pa = (r as any).pa
            if (!driverInfo && dr)
              driverInfo = { name: dr.employees?.full_name ?? null, tasNumber: dr.drivers?.tas_badge_number ?? null }
            if (!paInfo && pa)
              paInfo = { name: pa.employees?.full_name ?? null, tasNumber: pa.passenger_assistants?.tas_badge_number ?? null }
          }
        }
      }

      const payload = {
        ...inc,
        incident_employees: relatedEmployees ?? [],
        incident_passengers: relatedPassengers ?? [],
        driverInfo: driverInfo ?? null,
        paInfo: paInfo ?? null,
      }
      console.debug('[CreateIncidentPage] loadFormIncident ok', { id })
      return { ok: true as const, payload }
    },
    [supabase]
  )

  useEffect(() => {
    if (!createdIncidentId) {
      setFormIncident(null)
      setReportFormsLoading(false)
      setReportFormsError(null)
      return
    }

    let cancelled = false
    setReportFormsLoading(true)
    setReportFormsError(null)

    void (async () => {
      const result = await loadFormIncident(createdIncidentId)
      if (cancelled) return
      if (result.ok) {
        setFormIncident(result.payload)
        setReportFormsError(null)
      } else {
        setFormIncident(null)
        setReportFormsError(result.error)
      }
      setReportFormsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [createdIncidentId, loadFormIncident])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) {
        throw new Error('You must be logged in to create an incident')
      }

      const { data: userData } = await supabase.from('users').select('id').eq('email', authUser.email).maybeSingle()

      const trSnapshots = {
        tr5: reportFormsDraftRef.current?.getTr5Payload() ?? null,
        tr6: reportFormsDraftRef.current?.getTr6Payload() ?? null,
        tr7: reportFormsDraftRef.current?.getTr7Payload() ?? null,
      }
      console.debug('[CreateIncidentPage] TR form snapshots before insert', {
        hasTr5: Boolean(trSnapshots.tr5),
        hasTr6: Boolean(trSnapshots.tr6),
        hasTr7: Boolean(trSnapshots.tr7),
      })

      const tr5 = trSnapshots.tr5 as { photosAttached?: boolean; photoAttachments?: unknown } | null
      if (tr5?.photosAttached === true) {
        const atts = tr5.photoAttachments
        if (!Array.isArray(atts) || atts.length === 0) {
          setError('TR5: You answered Yes for photos — attach at least one file in the TR5 form before creating the incident.')
          console.debug('[CreateIncidentPage] blocked create: TR5 photos Yes without attachments')
          setLoading(false)
          return
        }
      }

      const insertRow = {
        vehicle_id: formData.vehicle_id ? parseInt(formData.vehicle_id, 10) : null,
        route_id: formData.route_id ? parseInt(formData.route_id, 10) : null,
        route_session_id: formData.route_session_id ? parseInt(formData.route_session_id, 10) : null,
        incident_type: formData.incident_type.trim(),
        description: formData.description.trim(),
        resolved: formData.resolved,
        created_by: userData?.id ?? null,
        reported_at: draftReportedAt,
      }

      console.debug('[CreateIncidentPage] insert incident', {
        hasVehicle: Boolean(insertRow.vehicle_id),
        hasRoute: Boolean(insertRow.route_id),
        hasSession: Boolean(insertRow.route_session_id),
      })

      const { data: incidentData, error: incidentError } = await supabase.from('incidents').insert([insertRow]).select().single()

      if (incidentError) throw incidentError

      const incidentId = incidentData.id

      if (selectedEmployees.length > 0) {
        const employeeLinks = selectedEmployees.map((employeeId) => ({
          incident_id: incidentId,
          employee_id: employeeId,
        }))
        const { error: employeesError } = await supabase.from('incident_employees').insert(employeeLinks)
        if (employeesError) console.error('Error linking employees:', employeesError)
      }

      if (selectedPassengers.length > 0) {
        const passengerLinks = selectedPassengers.map((passengerId) => ({
          incident_id: incidentId,
          passenger_id: passengerId,
        }))
        const { error: passengersError } = await supabase.from('incident_passengers').insert(passengerLinks)
        if (passengersError) console.error('Error linking passengers:', passengersError)
      }

      await persistTrDocuments(supabase, {
        incidentId,
        userId: userData?.id ?? null,
        tr5: trSnapshots.tr5,
        tr6: trSnapshots.tr6,
        tr7: trSnapshots.tr7,
      })

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'incidents',
          record_id: incidentId,
          action: 'CREATE',
        }),
      }).catch((err) => console.error('Audit log error:', err))

      setCreatedIncidentId(incidentId)
    } catch (err: any) {
      console.error('Error creating incident:', err)
      setError(err.message || 'An error occurred while creating the incident')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
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
            {createdIncidentId
              ? 'Report forms were saved with the incident. Review below or open the incident.'
              : 'Complete incident details, report forms, then use Cancel or Create incident at the very bottom. Save form is available after type and description are filled; Create stores everything.'}
          </p>
        </div>
      </div>

      {createdIncidentId && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-800 text-sm">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <span>Incident #{createdIncidentId} created (including saved report forms). Review below or view the incident.</span>
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

      {!createdIncidentId && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                    <Label htmlFor="incident_type" className="text-xs font-medium text-slate-600">
                      Incident Type *
                    </Label>
                    <Input
                      id="incident_type"
                      required
                      value={formData.incident_type}
                      onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
                      className="h-9"
                      placeholder="e.g. Accident, Complaint"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="resolved" className="text-xs font-medium text-slate-600">
                      Status
                    </Label>
                    <Select
                      id="resolved"
                      value={formData.resolved ? 'true' : 'false'}
                      onChange={(e) => setFormData({ ...formData, resolved: e.target.value === 'true' })}
                      className="h-9"
                    >
                      <option value="false">Open</option>
                      <option value="true">Resolved</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="description" className="text-xs font-medium text-slate-600">
                    Description *
                  </Label>
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
              </div>
            </div>

            <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center">
                <Car className="mr-2 h-4 w-4" />
                Vehicle & Route
              </h2>
            </div>
            <div className="p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <SearchablePickOne
                  inputId="vehicle_id"
                  label="Vehicle"
                  value={formData.vehicle_id}
                  onChange={(next) => setFormData({ ...formData, vehicle_id: next })}
                  options={vehicleOptions}
                  placeholder="Search vehicle…"
                />
                <SearchablePickOne
                  inputId="route_id"
                  label="Route"
                  value={formData.route_id}
                  onChange={(next) => {
                    setFormData({ ...formData, route_id: next, route_session_id: '' })
                    if (next) void loadRouteSessions(parseInt(next, 10))
                    else setRouteSessions([])
                  }}
                  options={routeOptions}
                  placeholder="Search route…"
                />
                {formData.route_id ? (
                  <SearchablePickOne
                    inputId="route_session_id"
                    label="Route Session"
                    value={formData.route_session_id}
                    onChange={(next) => setFormData({ ...formData, route_session_id: next })}
                    options={sessionOptions}
                    disabled={loadingSessions}
                    placeholder={loadingSessions ? 'Loading sessions…' : 'Search session…'}
                  />
                ) : null}
              </div>
            </div>

            <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center">
                <UserCog className="mr-2 h-4 w-4" />
                Related Employees ({selectedEmployees.length} selected)
              </h2>
            </div>
            <div className="p-4 space-y-2">
              <Input
                type="search"
                value={employeeQuery}
                onChange={(e) => setEmployeeQuery(e.target.value)}
                placeholder="Search employees…"
                className="h-9 max-w-md"
                autoComplete="off"
              />
              {employees.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No employees available</p>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No employees match your search</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-5 max-h-40 overflow-y-auto">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                        selectedEmployees.includes(employee.id)
                          ? 'border-[#023E8A] bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={() => toggleEmployee(employee.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(employee.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleEmployee(employee.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]"
                      />
                      <span className="ml-2 text-sm text-slate-700 truncate">{employee.full_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Related Passengers ({selectedPassengers.length} selected)
              </h2>
            </div>
            <div className="p-4 space-y-2">
              <Input
                type="search"
                value={passengerQuery}
                onChange={(e) => setPassengerQuery(e.target.value)}
                placeholder="Search passengers…"
                className="h-9 max-w-md"
                autoComplete="off"
              />
              {passengers.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No passengers available</p>
              ) : filteredPassengers.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No passengers match your search</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-5 max-h-40 overflow-y-auto">
                  {filteredPassengers.map((passenger) => (
                    <div
                      key={passenger.id}
                      className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                        selectedPassengers.includes(passenger.id)
                          ? 'border-[#023E8A] bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={() => togglePassenger(passenger.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPassengers.includes(passenger.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => togglePassenger(passenger.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]"
                      />
                      <span className="ml-2 text-sm text-slate-700 truncate">{passenger.full_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <IncidentReportForms
            ref={reportFormsDraftRef}
            isDraft
            incident={draftIncident as any}
            driverInfo={draftDriverPa.driverInfo}
            paInfo={draftDriverPa.paInfo}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              className="border-slate-300 text-slate-600 hover:bg-slate-50"
              onClick={() => {
                if (
                  !confirm(
                    'Leave this page? Any incident details and report forms you have not submitted will be lost.'
                  )
                ) {
                  console.debug('[CreateIncidentPage] cancel dismissed')
                  return
                }
                console.debug('[CreateIncidentPage] cancel confirmed, navigating to incidents list')
                router.push('/dashboard/incidents')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-[#023E8A] hover:bg-[#023E8A]/90 text-white">
              {loading ? 'Submitting...' : 'Create incident'}
            </Button>
          </div>
        </>
      )}

      {createdIncidentId && reportFormsLoading && (
        <p className="text-sm text-slate-500">Loading incident report forms (TR5 / TR6 / TR7)…</p>
      )}

      {createdIncidentId && reportFormsError && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          Report forms could not be loaded: {reportFormsError}. You can still open the incident and complete forms from the incident page.
        </div>
      )}

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
