'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import { X, Car, CheckCircle } from 'lucide-react'

interface ReplacementVehicle {
  vehicle_id: number
  registration_number: string
  make: string
  model: string
  seating_plan_name: string
  total_capacity: number
  rows: number
  seats_per_row: number
  wheelchair_spaces: number
  match_type: string
  capacity_difference: number
}

interface ReplacementVehicleFinderProps {
  breakdownId: number
  onClose: () => void
  onAssign: (vehicleId: number) => void
}

export default function ReplacementVehicleFinder({
  breakdownId,
  onClose,
  onAssign
}: ReplacementVehicleFinderProps) {
  const [vehicles, setVehicles] = useState<ReplacementVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<number | null>(null)
  const [assigned, setAssigned] = useState<number | null>(null)

  useEffect(() => {
    loadReplacementVehicles()
  }, [breakdownId])

  const loadReplacementVehicles = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/breakdowns/${breakdownId}/replacement`)
      const data = await response.json()
      
      if (data.success) {
        setVehicles(data.vehicles || [])
      } else {
        alert('Error loading replacement vehicles: ' + data.error)
      }
    } catch (error) {
      alert('Error loading replacement vehicles')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (vehicleId: number) => {
    if (!confirm('Assign this vehicle as replacement? The route will be updated automatically.')) {
      return
    }

    setAssigning(vehicleId)
    try {
      const response = await fetch(`/api/breakdowns/${breakdownId}/replacement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replacement_vehicle_id: vehicleId })
      })

      const data = await response.json()

      if (data.success) {
        setAssigned(vehicleId)
        alert('Replacement vehicle assigned successfully!')
        onAssign(vehicleId)
        setTimeout(() => onClose(), 2000)
      } else {
        alert('Error assigning vehicle: ' + data.error)
      }
    } catch (error) {
      alert('Error assigning vehicle')
    } finally {
      setAssigning(null)
    }
  }

  const getMatchBadge = (matchType: string) => {
    if (matchType === 'exact_spare') {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Exact Match (Spare)</span>
    }
    if (matchType === 'closest_spare') {
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">Closest Match (Spare)</span>
    }
    return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">Closest Match</span>
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="bg-red-600 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center">
              <Car className="mr-2 h-5 w-5" />
              Find Replacement Vehicle
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-red-700">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <p className="mt-2 text-gray-600">Finding replacement vehicles...</p>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No replacement vehicles available</p>
              <p className="text-sm text-gray-500">No spare vehicles or vehicles with matching seating plans found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Found {vehicles.length} replacement vehicle{vehicles.length !== 1 ? 's' : ''}. 
                Vehicles are sorted by best match (exact spare matches first).
              </p>
              
              <div className="space-y-3">
                {vehicles.map((vehicle) => (
                  <div
                    key={vehicle.vehicle_id}
                    className={`p-4 border-2 rounded-lg ${
                      assigned === vehicle.vehicle_id
                        ? 'bg-green-50 border-green-500'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Link
                            href={`/dashboard/vehicles/${vehicle.vehicle_id}`}
                            className="font-semibold text-lg text-navy hover:text-blue-800"
                          >
                            {vehicle.registration_number}
                          </Link>
                          {getMatchBadge(vehicle.match_type)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Make/Model:</span>
                            <div className="font-medium">{vehicle.make} {vehicle.model}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Capacity:</span>
                            <div className="font-medium">{vehicle.total_capacity} passengers</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Wheelchair:</span>
                            <div className="font-medium">{vehicle.wheelchair_spaces}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Layout:</span>
                            <div className="font-medium">{vehicle.rows} rows × {vehicle.seats_per_row}</div>
                          </div>
                        </div>

                        <div className="text-xs text-gray-500">
                          Plan: {vehicle.seating_plan_name}
                          {vehicle.capacity_difference > 0 && (
                            <span className="ml-2">(+{vehicle.capacity_difference} capacity)</span>
                          )}
                        </div>
                      </div>

                      <div className="ml-4">
                        {assigned === vehicle.vehicle_id ? (
                          <div className="flex items-center text-green-600">
                            <CheckCircle className="h-5 w-5 mr-1" />
                            <span className="text-sm font-medium">Assigned</span>
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleAssign(vehicle.vehicle_id)}
                            disabled={assigning !== null}
                            className="bg-navy hover:bg-blue-800"
                          >
                            {assigning === vehicle.vehicle_id ? 'Assigning...' : 'Assign Vehicle'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

