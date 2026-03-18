'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'

interface Vehicle {
  id: number
  vehicle_identifier: string
  make: string
  model: string
  registration: string | null
  spare_vehicle: boolean
  off_the_road: boolean | null
}

export default function CreateVehicleLocationPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    vehicle_id: '',
    location_name: '',
    address: '',
    latitude: '',
    longitude: '',
  })

  useEffect(() => {
    async function fetchVehicles() {
      const supabase = createClient()
      
      // Only fetch spare vehicles that are not off the road
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, vehicle_identifier, make, model, registration, spare_vehicle, off_the_road')
        .eq('spare_vehicle', true)
        .or('off_the_road.is.null,off_the_road.eq.false')
        .order('vehicle_identifier')

      if (!error && data) {
        setVehicles(data)
      }
    }
    fetchVehicles()
  }, [])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.vehicle_id) {
      newErrors.vehicle_id = 'Please select a vehicle'
    }
    if (!formData.location_name.trim()) {
      newErrors.location_name = 'Location name is required'
    }
    if (formData.latitude && isNaN(parseFloat(formData.latitude))) {
      newErrors.latitude = 'Latitude must be a valid number'
    }
    if (formData.latitude && (parseFloat(formData.latitude) < -90 || parseFloat(formData.latitude) > 90)) {
      newErrors.latitude = 'Latitude must be between -90 and 90'
    }
    if (formData.longitude && isNaN(parseFloat(formData.longitude))) {
      newErrors.longitude = 'Longitude must be a valid number'
    }
    if (formData.longitude && (parseFloat(formData.longitude) < -180 || parseFloat(formData.longitude) > 180)) {
      newErrors.longitude = 'Longitude must be between -180 and 180'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      const insertData: any = {
        vehicle_id: parseInt(formData.vehicle_id),
        location_name: formData.location_name.trim(),
        address: formData.address.trim() || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      }

      const { data: locationResult, error } = await supabase
        .from('vehicle_locations')
        .insert(insertData)
        .select()

      if (error) throw error

      // Audit log
      if (locationResult && locationResult[0]) {
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_name: 'vehicle_locations',
            record_id: locationResult[0].id,
            action: 'CREATE',
          }),
        }).catch(err => console.error('Audit log error:', err))
      }

      startTransition(() => {
        router.push('/dashboard/vehicle-locations')
        router.refresh()
      })
    } catch (error: any) {
      console.error('Error creating vehicle location:', error)
      setErrors({ submit: error.message || 'Failed to create vehicle location' })
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Add Spare Vehicle Location</h1>
          <p className="mt-2 text-sm text-gray-600">
            Record the current location of a spare vehicle
          </p>
        </div>
        <Link href="/dashboard/vehicle-locations" prefetch={true}>
          <Button variant="secondary">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Location Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vehicle Selection */}
            <div className="space-y-2">
              <Label htmlFor="vehicle_id">
                Spare Vehicle <span className="text-red-500">*</span>
              </Label>
              <select
                id="vehicle_id"
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                disabled={isLoading}
              >
                <option value="">Select a spare vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_identifier} - {vehicle.make} {vehicle.model}
                    {vehicle.registration ? ` [${vehicle.registration}]` : ''}
                  </option>
                ))}
              </select>
              {errors.vehicle_id && (
                <p className="text-sm text-red-500">{errors.vehicle_id}</p>
              )}
              {vehicles.length === 0 && (
                <p className="text-sm text-yellow-600">
                  No spare vehicles available. Please mark a vehicle as spare first.
                </p>
              )}
            </div>

            {/* Location Name */}
            <div className="space-y-2">
              <Label htmlFor="location_name">
                Location Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="location_name"
                type="text"
                placeholder="e.g., Main Depot, Customer Site A"
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                disabled={isLoading}
              />
              {errors.location_name && (
                <p className="text-sm text-red-500">{errors.location_name}</p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                placeholder="Full address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={isLoading}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>

            {/* Coordinates */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="text"
                  placeholder="e.g., 51.5074"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  disabled={isLoading}
                />
                {errors.latitude && (
                  <p className="text-sm text-red-500">{errors.latitude}</p>
                )}
                <p className="text-xs text-gray-500">Range: -90 to 90</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="text"
                  placeholder="e.g., -0.1278"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  disabled={isLoading}
                />
                {errors.longitude && (
                  <p className="text-sm text-red-500">{errors.longitude}</p>
                )}
                <p className="text-xs text-gray-500">Range: -180 to 180</p>
              </div>
            </div>

            {/* Error Message */}
            {errors.submit && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{errors.submit}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <Link href="/dashboard/vehicle-locations">
                <Button type="button" variant="secondary" disabled={isLoading}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isLoading || isPending || vehicles.length === 0}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading || isPending ? 'Creating...' : 'Create Location'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

