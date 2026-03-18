'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Plus, Trash2, MapPin, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { generateUUID } from '@/lib/utils'

interface RoutePoint {
  id: string
  point_name: string
  address: string
  latitude: string
  longitude: string
  stop_order: number
  passenger_id: string | null
  pickup_time_am: string
  pickup_time_pm: string
}

export default function CreateRoutePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schools, setSchools] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [passengerAssistants, setPassengerAssistants] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [passengers, setPassengers] = useState<any[]>([])
  const [paAddresses, setPaAddresses] = useState<Record<number, string>>({})

  const [formData, setFormData] = useState({
    route_number: '',
    school_id: searchParams?.get('school_id') || '',
    driver_id: '',
    passenger_assistant_id: '', // primary/first PA (for APA logic)
    vehicle_id: '',
    am_start_time: '',
    pm_start_time: '',
    pm_start_time_friday: '',
    days_of_week: [] as string[],
  })
  const [selectedPaIds, setSelectedPaIds] = useState<number[]>([])

  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([
    {
      id: generateUUID(),
      point_name: '',
      address: '',
      latitude: '',
      longitude: '',
      stop_order: 1,
      passenger_id: null, // First point is for PA, no passenger
      pickup_time_am: '',
      pickup_time_pm: '',
    },
  ])
  const routePointsRef = useRef(routePoints)
  routePointsRef.current = routePoints

  const addRoutePoint = () => {
    const nextOrder = routePoints.length + 1
    setRoutePoints([
      ...routePoints,
      {
        id: generateUUID(),
        point_name: '',
        address: '',
        latitude: '',
        longitude: '',
        stop_order: nextOrder,
        passenger_id: null,
        pickup_time_am: '',
        pickup_time_pm: '',
      },
    ])
  }

  const removeRoutePoint = (id: string) => {
    const newPoints = routePoints.filter((point) => point.id !== id)
    // Re-order remaining points
    const reorderedPoints = newPoints.map((point, index) => ({
      ...point,
      stop_order: index + 1,
    }))
    setRoutePoints(reorderedPoints)
  }

  const updateRoutePoint = (id: string, field: keyof RoutePoint, value: string | number | null) => {
    setRoutePoints(
      routePoints.map((point) =>
        point.id === id ? { ...point, [field]: value } : point
      )
    )
  }

  const movePointUp = (index: number) => {
    if (index === 0) return
    const newPoints = [...routePoints]
      ;[newPoints[index - 1], newPoints[index]] = [newPoints[index], newPoints[index - 1]]
    const reorderedPoints = newPoints.map((point, idx) => ({
      ...point,
      stop_order: idx + 1,
    }))
    setRoutePoints(reorderedPoints)
  }

  const movePointDown = (index: number) => {
    if (index === routePoints.length - 1) return
    const newPoints = [...routePoints]
      ;[newPoints[index], newPoints[index + 1]] = [newPoints[index + 1], newPoints[index]]
    const reorderedPoints = newPoints.map((point, idx) => ({
      ...point,
      stop_order: idx + 1,
    }))
    setRoutePoints(reorderedPoints)
  }

  useEffect(() => {
    async function loadData() {
      const [schoolsResult, driversResult, pasResult, vehiclesResult] = await Promise.all([
        supabase.from('schools').select('id, name').order('name'),
        supabase
          .from('drivers')
          .select('employee_id, employees(full_name, employment_status, can_work)')
          .order('employee_id'),
        supabase
          .from('passenger_assistants')
          .select('employee_id, employees(full_name, employment_status, can_work, address)')
          .order('employee_id'),
        supabase
          .from('vehicles')
          .select('id, vehicle_identifier, registration, make, model, plate_number, off_the_road')
          .eq('off_the_road', false)
          .order('vehicle_identifier'),
      ])

      if (schoolsResult.data) {
        setSchools(schoolsResult.data)
      }

      if (driversResult.data) {
        setDrivers(
          driversResult.data
            .filter((d: any) => d.employees?.employment_status === 'Active' && d.employees?.can_work !== false)
            .map((d: any) => ({
              id: d.employee_id,
              name: d.employees?.full_name || 'Unknown',
            }))
        )
      }

      if (pasResult.data) {
        const pas = pasResult.data
          .filter((pa: any) => pa.employees?.employment_status === 'Active' && pa.employees?.can_work !== false)
          .map((pa: any) => ({
            id: pa.employee_id,
            name: pa.employees?.full_name || 'Unknown',
          }))
        setPassengerAssistants(pas)

        // Store PA addresses for later use
        const addresses: Record<number, string> = {}
        pasResult.data.forEach((pa: any) => {
          if (pa.employees?.address) {
            addresses[pa.employee_id] = pa.employees.address
          }
        })
        setPaAddresses(addresses)
      }

      if (vehiclesResult.data) {
        setVehicles(vehiclesResult.data)
      }
    }

    loadData()
  }, [supabase])

  // Load passengers when school is selected
  useEffect(() => {
    async function loadPassengers() {
      if (!formData.school_id) {
        setPassengers([])
        return
      }

      const { data: passengersData, error } = await supabase
        .from('passengers')
        .select('id, full_name, address')
        .eq('school_id', formData.school_id)
        .order('full_name')

      if (!error && passengersData) {
        setPassengers(passengersData)
      } else {
        setPassengers([])
      }
    }

    loadPassengers()
  }, [formData.school_id, supabase])

  // Keep primary PA (for APA logic) in sync with first selected PA
  useEffect(() => {
    const first = selectedPaIds.length > 0 ? selectedPaIds[0] : null
    setFormData(prev => ({ ...prev, passenger_assistant_id: first ? String(first) : '' }))
  }, [selectedPaIds])

  // Auto-add APA address as pickup point when APA is assigned and AM/PM times are set
  useEffect(() => {
    const currentPoints = routePointsRef.current

    if (!formData.passenger_assistant_id) {
      // Remove APA points if PA is removed - check all possible PA addresses
      const allPaAddresses = Object.values(paAddresses)
      const updatedPoints = currentPoints.filter(
        point => {
          const nameLower = point.point_name.toLowerCase()
          const isApaPoint = (nameLower.includes('apa') && nameLower.includes('home')) ||
            allPaAddresses.includes(point.address || '')
          return !isApaPoint
        }
      )
      if (updatedPoints.length !== currentPoints.length) {
        const reordered = updatedPoints.map((point, idx) => ({
          ...point,
          stop_order: idx + 1,
        }))
        setRoutePoints(reordered)
      }
      return
    }

    const selectedPA = passengerAssistants.find(pa => pa.id === parseInt(formData.passenger_assistant_id))
    if (!selectedPA) return

    // Check if PA name contains "APA" (case-insensitive)
    const isAPA = selectedPA.name.toLowerCase().includes('apa')
    if (!isAPA) {
      // Remove APA points if PA is not APA - check all possible PA addresses
      const allPaAddresses = Object.values(paAddresses)
      const updatedPoints = currentPoints.filter(
        point => {
          const nameLower = point.point_name.toLowerCase()
          const isApaPoint = (nameLower.includes('apa') && nameLower.includes('home')) ||
            allPaAddresses.includes(point.address || '')
          return !isApaPoint
        }
      )
      if (updatedPoints.length !== currentPoints.length) {
        const reordered = updatedPoints.map((point, idx) => ({
          ...point,
          stop_order: idx + 1,
        }))
        setRoutePoints(reordered)
      }
      return
    }

    const paAddress = paAddresses[parseInt(formData.passenger_assistant_id)]
    if (!paAddress) return

    let updatedPoints = [...currentPoints]
    let hasChanges = false

    // For AM routes: ensure first point is APA address
    if (formData.am_start_time) {
      const firstPoint = updatedPoints[0]
      const isFirstApa = firstPoint && (
        (firstPoint.point_name.toLowerCase().includes('apa') && firstPoint.point_name.toLowerCase().includes('home')) ||
        firstPoint.address === paAddress
      )

      if (!isFirstApa) {
        // Remove any existing APA points
        updatedPoints = updatedPoints.filter(
          point => !(
            (point.point_name.toLowerCase().includes('apa') && point.point_name.toLowerCase().includes('home')) ||
            point.address === paAddress
          )
        )

        // Add APA as first point
        const apaPoint: RoutePoint = {
          id: generateUUID(),
          point_name: `${selectedPA.name} - Home`,
          address: paAddress,
          latitude: '',
          longitude: '',
          stop_order: 1,
          passenger_id: null,
          pickup_time_am: '',
          pickup_time_pm: '',
        }

        // Shift existing points down
        updatedPoints = updatedPoints.map((point, idx) => ({
          ...point,
          stop_order: idx + 2,
        }))

        updatedPoints = [apaPoint, ...updatedPoints]
        hasChanges = true
      }
    } else {
      // Remove first APA point if AM time is removed
      if (updatedPoints[0] && (
        (updatedPoints[0].point_name.toLowerCase().includes('apa') && updatedPoints[0].point_name.toLowerCase().includes('home')) ||
        updatedPoints[0].address === paAddress
      )) {
        updatedPoints = updatedPoints.slice(1).map((point, idx) => ({
          ...point,
          stop_order: idx + 1,
        }))
        hasChanges = true
      }
    }

    // For PM routes: ensure last point is APA address
    if (formData.pm_start_time) {
      const lastPoint = updatedPoints[updatedPoints.length - 1]
      const isLastApa = lastPoint && (
        (lastPoint.point_name.toLowerCase().includes('apa') && lastPoint.point_name.toLowerCase().includes('home')) ||
        lastPoint.address === paAddress
      )

      if (!isLastApa) {
        // Remove any existing APA points that aren't first (keep first if AM exists)
        updatedPoints = updatedPoints.filter(
          (point, idx) => {
            if (idx === 0 && formData.am_start_time) return true // Keep first if AM route
            return !(
              (point.point_name.toLowerCase().includes('apa') && point.point_name.toLowerCase().includes('home')) ||
              point.address === paAddress
            )
          }
        )

        // Add APA as last point
        const nextOrder = updatedPoints.length > 0
          ? Math.max(...updatedPoints.map(p => p.stop_order)) + 1
          : 1
        const apaPoint: RoutePoint = {
          id: generateUUID(),
          point_name: `${selectedPA.name} - Home`,
          address: paAddress,
          latitude: '',
          longitude: '',
          stop_order: nextOrder,
          passenger_id: null,
          pickup_time_am: '',
          pickup_time_pm: '',
        }

        updatedPoints = [...updatedPoints, apaPoint]
        hasChanges = true
      }
    } else {
      // Remove last APA point if PM time is removed (but keep first if AM exists)
      if (updatedPoints.length > 0) {
        const lastPoint = updatedPoints[updatedPoints.length - 1]
        if (lastPoint && (
          (lastPoint.point_name.toLowerCase().includes('apa') && lastPoint.point_name.toLowerCase().includes('home')) ||
          lastPoint.address === paAddress
        ) && !formData.am_start_time) {
          // Only remove if it's not the first point (which would be for AM)
          updatedPoints = updatedPoints.slice(0, -1)
          hasChanges = true
        }
      }
    }

    if (hasChanges) {
      // Reorder all points
      const reordered = updatedPoints.map((point, idx) => ({
        ...point,
        stop_order: idx + 1,
      }))
      setRoutePoints(reordered)
    }
  }, [formData.passenger_assistant_id, formData.am_start_time, formData.pm_start_time, passengerAssistants, paAddresses])

  // Helper function to check if a driver/PA is authorized to work
  const checkAuthorization = async (employeeId: string, type: 'driver' | 'pa'): Promise<{ authorized: boolean; reason?: string }> => {
    if (!employeeId) return { authorized: true }

    const selectQuery = type === 'driver'
      ? 'id, full_name, can_work, employment_status, drivers(tas_badge_expiry_date, taxi_badge_expiry_date, dbs_expiry_date, driving_license_expiry_date, cpc_expiry_date)'
      : 'id, full_name, can_work, employment_status, passenger_assistants(tas_badge_expiry_date, dbs_expiry_date, first_aid_certificate_expiry_date, passport_expiry_date)'

    const { data: employee, error } = await supabase
      .from('employees')
      .select(selectQuery)
      .eq('id', parseInt(employeeId))
      .single()

    if (error || !employee) {
      return { authorized: false, reason: `Failed to fetch ${type} information` }
    }

    // Check employment status
    if (employee.employment_status !== 'Active') {
      return { authorized: false, reason: `${employee.full_name} is not an active employee` }
    }

    // Check can_work flag
    if (employee.can_work === false) {
      const expiredCerts: string[] = []
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const checkDate = (date: string | null, certName: string) => {
        if (!date) return
        const expiry = new Date(date)
        expiry.setHours(0, 0, 0, 0)
        if (expiry < today) {
          expiredCerts.push(certName)
        }
      }

      if (type === 'driver') {
        const employeeWithDrivers = employee as any
        const driver = Array.isArray(employeeWithDrivers.drivers) ? employeeWithDrivers.drivers[0] : employeeWithDrivers.drivers
        if (driver) {
          checkDate(driver.tas_badge_expiry_date, 'TAS Badge')
          checkDate(driver.taxi_badge_expiry_date, 'Taxi Badge')
          checkDate(driver.dbs_expiry_date, 'DBS')
          checkDate(driver.driving_license_expiry_date, 'Driving License')
          checkDate(driver.cpc_expiry_date, 'CPC')
        }
      } else {
        const employeeWithPAs = employee as any
        const pa = Array.isArray(employeeWithPAs.passenger_assistants) ? employeeWithPAs.passenger_assistants[0] : employeeWithPAs.passenger_assistants
        if (pa) {
          checkDate(pa.tas_badge_expiry_date, 'TAS Badge')
          checkDate(pa.dbs_expiry_date, 'DBS')
          checkDate(pa.first_aid_certificate_expiry_date, 'First Aid Certificate')
          checkDate(pa.passport_expiry_date, 'Passport')
        }
      }

      const reason = expiredCerts.length > 0
        ? `${employee.full_name} cannot be assigned because they have expired certificates: ${expiredCerts.join(', ')}`
        : `${employee.full_name} is not authorized to work. Please check their profile for compliance issues.`

      return { authorized: false, reason }
    }

    return { authorized: true }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate driver authorization
      if (formData.driver_id) {
        const driverAuth = await checkAuthorization(formData.driver_id, 'driver')
        if (!driverAuth.authorized) {
          setError(driverAuth.reason || 'Driver is not authorized to work')
          setLoading(false)
          return
        }
      }

      // Validate PA authorization for all selected PAs
      for (const paId of selectedPaIds) {
        const paAuth = await checkAuthorization(String(paId), 'pa')
        if (!paAuth.authorized) {
          setError(paAuth.reason || 'One or more Passenger Assistants are not authorized to work')
          setLoading(false)
          return
        }
      }

      const primaryPaId = selectedPaIds.length > 0 ? selectedPaIds[0] : null

      // Step 1: Create the route
      const routeDataToInsert = {
        route_number: formData.route_number,
        school_id: formData.school_id || null,
        driver_id: formData.driver_id || null,
        passenger_assistant_id: primaryPaId,
        vehicle_id: formData.vehicle_id || null,
        am_start_time: formData.am_start_time || null,
        pm_start_time: formData.pm_start_time || null,
        pm_start_time_friday: formData.pm_start_time_friday || null,
        days_of_week: formData.days_of_week.length > 0 ? formData.days_of_week : null,
      }

      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .insert([routeDataToInsert])
        .select()
        .single()

      if (routeError) throw routeError

      const routeId = routeData.id

      // Step 1b: Insert route_passenger_assistants (multiple PAs)
      if (selectedPaIds.length > 0) {
        const rpaRows = selectedPaIds.map((empId, idx) => ({
          route_id: routeId,
          employee_id: empId,
          sort_order: idx + 1,
        }))
        const { error: insertRpaError } = await supabase
          .from('route_passenger_assistants')
          .insert(rpaRows)
        if (insertRpaError) throw insertRpaError
      }

      // Step 2: Create route points (only ones with names filled in)
      const validRoutePoints = routePoints.filter(
        (point) => point.point_name.trim() !== ''
      )

      if (validRoutePoints.length > 0) {
        const pointsToInsert = validRoutePoints.map((point) => ({
          route_id: routeId,
          point_name: point.point_name,
          address: point.address || null,
          latitude: point.latitude ? parseFloat(point.latitude) : null,
          longitude: point.longitude ? parseFloat(point.longitude) : null,
          stop_order: point.stop_order,
          passenger_id: point.passenger_id ? parseInt(point.passenger_id) : null, // First point (stop_order 1) is for PA, should be null
          pickup_time_am: point.pickup_time_am || null,
          pickup_time_pm: point.pickup_time_pm || null,
        }))

        const { error: pointsError } = await supabase
          .from('route_points')
          .insert(pointsToInsert)

        if (pointsError) {
          console.error('Error creating route points:', pointsError)
          // Continue anyway - route is created
        }
      }

      // Step 3: Audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'routes',
          record_id: routeId,
          action: 'CREATE',
        }),
      })

      router.push('/dashboard/routes')
      router.refresh()
    } catch (error: any) {
      console.error('Error creating route:', error)
      setError(error.message || 'An error occurred while creating the route')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/routes">
          <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Add New Route</h1>
          <p className="text-sm text-slate-500">Create route with stops and schedule</p>
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
        {/* Route Details Section */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Route Details</h2>
        </div>
        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Route Number + School */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="route_number" className="text-xs font-medium text-slate-600">Route Number</Label>
                <Input
                  id="route_number"
                  value={formData.route_number}
                  onChange={(e) => setFormData({ ...formData, route_number: e.target.value })}
                  placeholder="e.g., R001"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="school_id" className="text-xs font-medium text-slate-600">School</Label>
                <Select
                  id="school_id"
                  value={formData.school_id}
                  onChange={(e) => setFormData({ ...formData, school_id: e.target.value })}
                  className="h-9"
                >
                  <option value="">Select a school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Row 2: Driver + Vehicle */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="driver_id" className="text-xs font-medium text-slate-600">Driver (Optional)</Label>
                <Select
                  id="driver_id"
                  value={formData.driver_id}
                  onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                  className="h-9"
                >
                  <option value="">Select driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="vehicle_id" className="text-xs font-medium text-slate-600">Vehicle (Optional)</Label>
                <Select
                  id="vehicle_id"
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="h-9"
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicle_identifier || vehicle.registration || `#${vehicle.id}`}
                      {vehicle.make && vehicle.model ? ` - ${vehicle.make} ${vehicle.model}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Passenger Assistants */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">Passenger Assistant(s)</Label>
              <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4 max-h-32 overflow-y-auto border rounded-md p-2 bg-slate-50">
                {passengerAssistants.map((pa) => (
                  <label
                    key={pa.id}
                    className="flex items-center gap-2 p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPaIds.includes(pa.id)}
                      onChange={() => {
                        setSelectedPaIds(prev =>
                          prev.includes(pa.id)
                            ? prev.filter((id) => id !== pa.id)
                            : [...prev, pa.id]
                        )
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]"
                    />
                    <span className="text-xs truncate">{pa.name}</span>
                  </label>
                ))}
              </div>
              {selectedPaIds.length > 0 && (
                <p className="text-xs text-slate-500">{selectedPaIds.length} PA(s) selected</p>
              )}
            </div>
          </form>
        </div>

        {/* Schedule Section */}
        <div className="border-t border-slate-100">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Schedule</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="am_start_time" className="text-xs font-medium text-slate-600">AM Start Time</Label>
                <Input
                  id="am_start_time"
                  type="time"
                  value={formData.am_start_time}
                  onChange={(e) => setFormData({ ...formData, am_start_time: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pm_start_time" className="text-xs font-medium text-slate-600">PM Start Time</Label>
                <Input
                  id="pm_start_time"
                  type="time"
                  value={formData.pm_start_time}
                  onChange={(e) => setFormData({ ...formData, pm_start_time: e.target.value })}
                  className="h-9"
                />
              </div>
              {formData.days_of_week.includes('Friday') && (
                <div className="space-y-1">
                  <Label htmlFor="pm_start_time_friday" className="text-xs font-medium text-slate-600">PM (Friday)</Label>
                  <Input
                    id="pm_start_time_friday"
                    type="time"
                    value={formData.pm_start_time_friday}
                    onChange={(e) => setFormData({ ...formData, pm_start_time_friday: e.target.value })}
                    className="h-9"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">Days of Week</Label>
              <div className="flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((shortDay, idx) => {
                  const fullDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][idx]
                  const isSelected = formData.days_of_week.includes(fullDay)
                  return (
                    <button
                      key={fullDay}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setFormData({ ...formData, days_of_week: formData.days_of_week.filter(d => d !== fullDay) })
                        } else {
                          setFormData({ ...formData, days_of_week: [...formData.days_of_week, fullDay] })
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${isSelected
                        ? 'bg-[#023E8A] text-white border-[#023E8A]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#023E8A] hover:text-[#023E8A]'
                        }`}
                    >
                      {shortDay}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pickup Points Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Pickup Points</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addRoutePoint}
            className="h-7 text-xs bg-[#023E8A] text-white hover:bg-[#023E8A]/90"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Stop
          </Button>
        </div>

        <div className="p-4 space-y-3">
          {routePoints.map((point, index) => (
            <div key={point.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
              {/* Stop Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="bg-[#023E8A] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {point.stop_order}
                  </span>
                  {point.stop_order === 1 && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">PA Pickup</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => movePointUp(index)}
                    disabled={index === 0}
                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                  >
                    ▲
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => movePointDown(index)}
                    disabled={index === routePoints.length - 1}
                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                  >
                    ▼
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRoutePoint(point.id)}
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Compact Form Grid */}
              <div className="grid gap-3 md:grid-cols-4">
                {/* Stop Name */}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Stop Name</Label>
                  <Input
                    value={point.point_name}
                    onChange={(e) => updateRoutePoint(point.id, 'point_name', e.target.value)}
                    placeholder="School Gate, etc."
                    className="h-8 text-sm"
                  />
                </div>

                {/* Passenger (only for stops > 1) */}
                {point.stop_order > 1 ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Passenger</Label>
                    <Select
                      value={point.passenger_id || ''}
                      onChange={(e) => {
                        const selectedPassengerId = e.target.value || null
                        const selectedPassenger = selectedPassengerId ? passengers.find((p) => p.id.toString() === selectedPassengerId) : null
                        setRoutePoints((prev) =>
                          prev.map((p) =>
                            p.id === point.id
                              ? {
                                  ...p,
                                  passenger_id: selectedPassengerId,
                                  ...(selectedPassenger?.address ? { address: selectedPassenger.address } : {}),
                                }
                              : p
                          )
                        )
                      }}
                      className="h-8 text-sm"
                    >
                      <option value="">Select passenger</option>
                      {passengers.map((passenger) => (
                        <option key={passenger.id} value={passenger.id.toString()}>
                          {passenger.full_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Type</Label>
                    <div className="h-8 flex items-center text-xs text-slate-500 bg-slate-100 rounded px-2">PA Pickup Point</div>
                  </div>
                )}

                {/* AM Time */}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">AM Time</Label>
                  <Input
                    type="time"
                    value={point.pickup_time_am}
                    onChange={(e) => updateRoutePoint(point.id, 'pickup_time_am', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>

                {/* PM Time */}
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">PM Time</Label>
                  <Input
                    type="time"
                    value={point.pickup_time_pm}
                    onChange={(e) => updateRoutePoint(point.id, 'pickup_time_pm', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Address Row */}
              <div className="mt-3 space-y-1">
                <Label className="text-xs text-slate-500">Address</Label>
                <Input
                  value={point.address}
                  onChange={(e) => updateRoutePoint(point.id, 'address', e.target.value)}
                  placeholder="Full address..."
                  className="h-8 text-sm"
                />
              </div>

              {/* Optional Coordinates (collapsed by default) */}
              <details className="mt-2">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                  + Coordinates (optional)
                </summary>
                <div className="grid gap-3 md:grid-cols-2 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={point.latitude}
                      onChange={(e) => updateRoutePoint(point.id, 'latitude', e.target.value)}
                      placeholder="e.g., 51.5074"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      value={point.longitude}
                      onChange={(e) => updateRoutePoint(point.id, 'longitude', e.target.value)}
                      placeholder="e.g., -0.1278"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </details>
            </div>
          ))}

          {routePoints.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pickup points yet. Click "Add Stop" to begin.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4">
        <Link href="/dashboard/routes">
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
            Cancel
          </Button>
        </Link>
        <Button onClick={handleSubmit} disabled={loading} className="bg-[#023E8A] hover:bg-[#023E8A]/90 text-white">
          {loading ? 'Creating...' : 'Create Route'}
        </Button>
      </div>
    </div>
  )
}

