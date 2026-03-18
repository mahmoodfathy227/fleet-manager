'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { AlertCircle, UserCog } from 'lucide-react'

interface AddIncidentFormProps {
  passengerId: number
  passengerRouteId: number | null
  onSuccess: () => void
  onCancel: () => void
}

export default function AddIncidentForm({
  passengerId,
  passengerRouteId,
  onSuccess,
  onCancel,
}: AddIncidentFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])

  const [formData, setFormData] = useState({
    incident_type: '',
    description: '',
    vehicle_id: '',
    route_id: passengerRouteId?.toString() || '',
    resolved: false,
  })

  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([])

  useEffect(() => {
    async function loadData() {
      const [employeesResult, vehiclesResult, routesResult] = await Promise.all([
        supabase.from('employees').select('id, full_name').order('full_name'),
        supabase.from('vehicles').select('id, vehicle_identifier').order('vehicle_identifier'),
        supabase.from('routes').select('id, route_number').order('route_number')
      ])

      if (employeesResult.data) setEmployees(employeesResult.data)
      if (vehiclesResult.data) setVehicles(vehiclesResult.data)
      if (routesResult.data) setRoutes(routesResult.data)
    }

    loadData()
  }, [supabase])

  // Auto-populate route, vehicle, and employees from passenger's route (driver + all PAs)
  useEffect(() => {
    async function loadRouteDetails() {
      if (!passengerRouteId) return

      const { data: routeData, error } = await supabase
        .from('routes')
        .select('id, vehicle_id, driver_id, passenger_assistant_id')
        .eq('id', passengerRouteId)
        .single()

      if (error || !routeData) {
        console.error('Error loading route details:', error)
        return
      }

      // Auto-populate route_id (already set, but ensure it's correct)
      setFormData(prev => ({
        ...prev,
        route_id: routeData.id.toString(),
      }))

      // Auto-populate vehicle_id
      if (routeData.vehicle_id) {
        setFormData(prev => ({
          ...prev,
          vehicle_id: routeData.vehicle_id.toString(),
        }))
      }

      // Auto-select driver and all PAs (from route_passenger_assistants or primary PA)
      const employeesToSelect: number[] = []
      if (routeData.driver_id) {
        employeesToSelect.push(routeData.driver_id)
      }
      const { data: routePas } = await supabase
        .from('route_passenger_assistants')
        .select('employee_id')
        .eq('route_id', passengerRouteId)
        .order('sort_order')
      if (routePas?.length) {
        routePas.forEach((r: { employee_id: number }) => {
          if (!employeesToSelect.includes(r.employee_id)) {
            employeesToSelect.push(r.employee_id)
          }
        })
      } else if (routeData.passenger_assistant_id && !employeesToSelect.includes(routeData.passenger_assistant_id)) {
        employeesToSelect.push(routeData.passenger_assistant_id)
      }
      if (employeesToSelect.length > 0) {
        setSelectedEmployees(employeesToSelect)
      }
    }

    loadRouteDetails()
  }, [passengerRouteId, supabase])

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!formData.incident_type || !formData.description) {
        throw new Error('Incident type and description are required')
      }

      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        throw new Error('You must be logged in to create an incident')
      }

      // Get user ID from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()

      // Step 1: Create the incident
      const incidentDataToInsert = {
        incident_type: formData.incident_type,
        description: formData.description,
        vehicle_id: formData.vehicle_id ? parseInt(formData.vehicle_id) : null,
        route_id: formData.route_id ? parseInt(formData.route_id) : null,
        resolved: formData.resolved,
        created_by: userData?.id || null,
      }

      const { data: incidentData, error: incidentError } = await supabase
        .from('incidents')
        .insert([incidentDataToInsert])
        .select()
        .single()

      if (incidentError) throw incidentError

      const incidentId = incidentData.id

      // Step 2: Link the passenger (always link the current passenger)
      const { error: passengerError } = await supabase
        .from('incident_passengers')
        .insert([{
          incident_id: incidentId,
          passenger_id: passengerId,
        }])

      if (passengerError) {
        console.error('Error linking passenger:', passengerError)
        throw new Error('Failed to link passenger to incident')
      }

      // Step 3: Link selected employees
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

      // Step 4: Audit log
      try {
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_name: 'incidents',
            record_id: incidentId,
            action: 'CREATE',
          }),
        })
      } catch (auditError) {
        console.error('Error creating audit log:', auditError)
        // Don't fail the whole operation if audit fails
      }

      router.refresh()
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the incident')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="incident_type">
            Incident Type <span className="text-red-500">*</span>
          </Label>
          <Select
            id="incident_type"
            required
            value={formData.incident_type}
            onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
          >
            <option value="">Select type</option>
            <option value="Accident">Accident</option>
            <option value="Complaint">Complaint</option>
            <option value="Safety Issue">Safety Issue</option>
            <option value="Other">Other</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="route_id">
            Related Route
            {formData.route_id && <span className="text-xs text-gray-500 ml-2">(Auto-filled from passenger)</span>}
          </Label>
          <Select
            id="route_id"
            value={formData.route_id}
            onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
          >
            <option value="">Select route</option>
            {routes.map((route) => (
              <option key={route.id} value={route.id}>
                {route.route_number || `Route ${route.id}`}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vehicle_id">
            Vehicle
            {formData.vehicle_id && <span className="text-xs text-gray-500 ml-2">(Auto-filled from route)</span>}
          </Label>
          <Select
            id="vehicle_id"
            value={formData.vehicle_id}
            onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
          >
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.vehicle_identifier || `Vehicle ${vehicle.id}`}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-red-500">*</span>
        </Label>
        <textarea
          id="description"
          required
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the incident in detail..."
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="resolved"
          checked={formData.resolved}
          onChange={(e) => setFormData({ ...formData, resolved: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
        />
        <Label htmlFor="resolved">Mark as Resolved</Label>
      </div>

      {/* Related Employees Section */}
      <div className="space-y-2">
        <Label className="flex items-center">
          <UserCog className="mr-2 h-4 w-4" />
          Related Employees ({selectedEmployees.length} selected)
          {selectedEmployees.length > 0 && <span className="text-xs text-gray-500 ml-2">(Driver and PA auto-selected from route)</span>}
        </Label>
        <div className="text-xs text-gray-500 mb-2">
          Driver and passenger assistant from the route are automatically selected. You can add or remove employees as needed.
        </div>
        {employees.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 max-h-48 overflow-y-auto border rounded-lg p-3 bg-white">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className={`flex items-center p-2 border rounded cursor-pointer transition-colors ${selectedEmployees.includes(employee.id)
                    ? 'border-navy bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                  }`}
                onClick={() => toggleEmployee(employee.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedEmployees.includes(employee.id)}
                  onChange={() => toggleEmployee(employee.id)}
                  className="h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
                />
                <div className="ml-2">
                  <p className="text-xs font-medium text-gray-900">
                    {employee.full_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Creating...' : 'Create Incident'}
        </Button>
      </div>
    </form>
  )
}

