'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { VehicleSeatingPlan, SubstitutionVehicle } from '@/lib/types'
import VisualSeatingGrid from './visual-grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import Link from 'next/link'
import { Pencil, X, Save, Copy } from 'lucide-react'

interface VehicleSeatingClientProps {
  vehicleId: string
  vehicle: {
    id: number
    registration: string | null
    make: string | null
    model: string | null
    vehicle_identifier: string | null
  }
  initialSeatingPlan: VehicleSeatingPlan | null
}

export default function VehicleSeatingClient({
  vehicleId,
  vehicle,
  initialSeatingPlan
}: VehicleSeatingClientProps) {
  const [seatingPlan, setSeatingPlan] = useState<VehicleSeatingPlan | null>(initialSeatingPlan)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [substitutionVehicles, setSubstitutionVehicles] = useState<SubstitutionVehicle[]>([])
  const [isLoadingSubstitutes, setIsLoadingSubstitutes] = useState(false)
  const [existingSeatingPlans, setExistingSeatingPlans] = useState<Array<{
    id: number
    name: string
    total_capacity: number
    vehicle_id: number
    vehicles: { vehicle_identifier: string | null; registration: string | null } | null
  }>>([])
  const [copySourcePlanId, setCopySourcePlanId] = useState<string>('')
  const [isLoadingClone, setIsLoadingClone] = useState(false)

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    total_capacity: '',
    rows: '',
    seats_per_row: '',
    wheelchair_spaces: '',
    notes: ''
  })

  const supabase = createClient()
  const vehicleIdNum = parseInt(vehicleId, 10)

  // Load existing seating plans from other vehicles (for "Apply existing plan")
  useEffect(() => {
    async function loadExistingPlans() {
      const { data, error } = await supabase
        .from('vehicle_seating_plans')
        .select('id, name, total_capacity, vehicle_id, vehicles(vehicle_identifier, registration)')
        .eq('is_active', true)
        .order('name')
      if (!error && data) {
        const list = (data as Array<{
          id: number
          name: string
          total_capacity: number
          vehicle_id: number
          vehicles: { vehicle_identifier: string | null; registration: string | null } | Array<{ vehicle_identifier: string | null; registration: string | null }> | null
        }>).filter((p) => p.vehicle_id !== vehicleIdNum).map((p) => ({
          ...p,
          vehicles: Array.isArray(p.vehicles) ? p.vehicles[0] ?? null : p.vehicles
        })) as Array<{
          id: number
          name: string
          total_capacity: number
          vehicle_id: number
          vehicles: { vehicle_identifier: string | null; registration: string | null } | null
        }>
        setExistingSeatingPlans(list)
      }
    }
    loadExistingPlans()
  }, [vehicleIdNum, supabase])

  // Initialize form when seating plan loads
  useEffect(() => {
    if (seatingPlan) {
      setFormData({
        name: seatingPlan.name,
        total_capacity: seatingPlan.total_capacity.toString(),
        rows: seatingPlan.rows.toString(),
        seats_per_row: seatingPlan.seats_per_row.toString(),
        wheelchair_spaces: seatingPlan.wheelchair_spaces.toString(),
        notes: seatingPlan.notes || ''
      })
    } else {
      // Default values for new plan
      setFormData({
        name: `${vehicle.make} ${vehicle.model} Standard Layout`,
        total_capacity: '4',
        rows: '2',
        seats_per_row: '2',
        wheelchair_spaces: '0',
        notes: ''
      })
    }
  }, [seatingPlan, vehicle])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate inputs
      const capacity = parseInt(formData.total_capacity)
      const rows = parseInt(formData.rows)
      const seatsPerRow = parseInt(formData.seats_per_row)
      const wheelchairSpaces = parseInt(formData.wheelchair_spaces)

      if (capacity <= 0 || rows <= 0 || seatsPerRow <= 0 || wheelchairSpaces < 0) {
        throw new Error('Please enter valid positive numbers')
      }

      const response = await fetch(`/api/vehicles/${vehicleId}/seating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          total_capacity: capacity,
          rows: rows,
          seats_per_row: seatsPerRow,
          wheelchair_spaces: wheelchairSpaces,
          notes: formData.notes || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update seating plan')
      }

      setSeatingPlan(result.data)
      setSuccess(seatingPlan ? 'Seating plan updated successfully!' : 'Seating plan created successfully!')
      setIsEditing(false)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFindSubstitutes = async () => {
    setIsLoadingSubstitutes(true)
    setError(null)

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/substitutes`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to find substitution vehicles')
      }

      setSubstitutionVehicles(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoadingSubstitutes(false)
    }
  }

  const handleApplyExistingPlan = async () => {
    if (!copySourcePlanId) return
    setIsLoadingClone(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/seating/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_plan_id: parseInt(copySourcePlanId, 10) }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to apply seating plan')
      }
      setSeatingPlan(result.data)
      setCopySourcePlanId('')
      setSuccess('Seating plan applied from existing plan.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoadingClone(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Seating Plan Display/Editor */}
        <div className="space-y-6">
          {/* Apply existing plan from another vehicle */}
          {existingSeatingPlans.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Apply existing seating plan</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Copy a seating plan from another vehicle to this one. This replaces the current plan if any.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="copy_source_plan" className="text-slate-600">Select plan</Label>
                  <select
                    id="copy_source_plan"
                    value={copySourcePlanId}
                    onChange={(e) => setCopySourcePlanId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Choose a plan…</option>
                    {existingSeatingPlans.map((p) => {
                      const v = p.vehicles
                      const label = v?.registration || v?.vehicle_identifier || `Vehicle ${p.vehicle_id}`
                      return (
                        <option key={p.id} value={String(p.id)}>
                          {p.name} ({p.total_capacity} seats) – {label}
                        </option>
                      )
                    })}
                  </select>
                </div>
                <Button
                  type="button"
                  onClick={handleApplyExistingPlan}
                  disabled={!copySourcePlanId || isLoadingClone}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  {isLoadingClone ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Applying…
                    </span>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Apply plan
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Current Seating Plan Card */}
          {seatingPlan && !isEditing ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Current Seating Plan</CardTitle>
                    <p className="text-sm text-slate-500 mt-1">{seatingPlan.name}</p>
                  </div>
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Visual Grid */}
                <VisualSeatingGrid seatingPlan={seatingPlan} />

                {/* Notes */}
                {seatingPlan.notes && (
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 mb-2">Notes</div>
                    <div className="text-sm text-slate-600">{seatingPlan.notes}</div>
                  </div>
                )}

                {/* Metadata */}
                <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
                  <div>Created: {new Date(seatingPlan.created_at).toLocaleString()}</div>
                  <div>Last Updated: {new Date(seatingPlan.updated_at).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Seating Plan Editor Form */
            <Card>
              <CardHeader>
                <CardTitle>
                  {seatingPlan ? 'Edit Seating Plan' : 'Create Seating Plan'}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  Configure the seating layout for this vehicle
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="name">Plan Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g., Standard Coach (45 passengers)"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="total_capacity">Total Capacity</Label>
                      <Input
                        id="total_capacity"
                        name="total_capacity"
                        type="number"
                        min="1"
                        value={formData.total_capacity}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="wheelchair_spaces">Wheelchair Spaces</Label>
                      <Input
                        id="wheelchair_spaces"
                        name="wheelchair_spaces"
                        type="number"
                        min="0"
                        value={formData.wheelchair_spaces}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="rows">Number of Rows</Label>
                      <Input
                        id="rows"
                        name="rows"
                        type="number"
                        min="1"
                        value={formData.rows}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="seats_per_row">Seats per Row</Label>
                      <Input
                        id="seats_per_row"
                        name="seats_per_row"
                        type="number"
                        min="1"
                        value={formData.seats_per_row}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="e.g., 2 wheelchair lifts, emergency exit row 5"
                      rows={3}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Saving...
                        </span>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          {seatingPlan ? 'Update' : 'Create'} Plan
                        </>
                      )}
                    </Button>

                    {seatingPlan && (
                      <Button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        variant="secondary"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Substitution Vehicles */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Substitution Vehicles</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Find available vehicles with matching or similar seating plans (exact matches shown first, then similar capacity)
              </p>
            </CardHeader>
            <CardContent>

              {!seatingPlan ? (
                <div className="text-center py-10 text-slate-500">
                  <div className="text-4xl mb-3">🪑</div>
                  <p>Create a seating plan first to find substitution vehicles</p>
                </div>
              ) : (
                <>
                  <Button
                    onClick={handleFindSubstitutes}
                    disabled={isLoadingSubstitutes}
                    className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 mb-4"
                  >
                    {isLoadingSubstitutes ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Searching...
                      </span>
                    ) : (
                      'Find Substitute Vehicles'
                    )}
                  </Button>

                  {substitutionVehicles.length > 0 ? (
                    <div className="space-y-3">
                      {substitutionVehicles.map((vehicle) => (
                        <div
                          key={vehicle.vehicle_id}
                          className="p-5 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <Link
                                href={`/dashboard/vehicles/${vehicle.vehicle_id}`}
                                className="font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                              >
                                {vehicle.registration_number}
                              </Link>
                              <div className="text-sm text-slate-600 mt-1">
                                {vehicle.make} {vehicle.model}
                              </div>
                            </div>
                            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                              Available
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 mb-4">
                            <div>Capacity: <span className="text-slate-900 font-medium">{vehicle.total_capacity}</span></div>
                            <div>Wheelchair: <span className="text-slate-900 font-medium">{vehicle.wheelchair_spaces}</span></div>
                            <div>Rows: <span className="text-slate-900 font-medium">{vehicle.rows}</span></div>
                            <div>Seats/Row: <span className="text-slate-900 font-medium">{vehicle.seats_per_row}</span></div>
                          </div>

                          <Link
                            href={`/dashboard/vehicles/${vehicle.vehicle_id}`}
                            className="text-sm text-violet-600 hover:text-violet-700 transition-colors"
                          >
                            View Vehicle Details →
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : substitutionVehicles.length === 0 && !isLoadingSubstitutes && error === null ? (
                    <div className="text-center py-10 text-slate-500">
                      <div className="text-4xl mb-3">🔍</div>
                      <p>Click "Find Substitute Vehicles" to search</p>
                    </div>
                  ) : substitutionVehicles.length === 0 && !isLoadingSubstitutes && error === null ? (
                    <div className="text-center py-10 text-slate-500">
                      <div className="text-4xl mb-3">🚫</div>
                      <p>No substitute vehicles available</p>
                      <p className="text-xs mt-2">
                        No vehicles with matching or similar seating plans found
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          {seatingPlan && (
            <Card>
              <CardHeader>
                <CardTitle>Seating Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-3 border-b border-slate-200">
                    <span className="text-slate-600">Plan Name</span>
                    <span className="text-slate-900 font-semibold">{seatingPlan.name}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-slate-200">
                    <span className="text-slate-600">Total Capacity</span>
                    <span className="text-slate-900 font-semibold">{seatingPlan.total_capacity} passengers</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-slate-200">
                    <span className="text-slate-600">Configuration</span>
                    <span className="text-slate-900 font-semibold">
                      {seatingPlan.rows} rows × {seatingPlan.seats_per_row} seats
                    </span>
                  </div>
                  <div className="flex justify-between py-3">
                    <span className="text-slate-600">Wheelchair Spaces</span>
                    <span className="text-yellow-600 font-semibold">{seatingPlan.wheelchair_spaces}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

