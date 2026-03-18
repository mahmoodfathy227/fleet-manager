'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'

interface Vehicle {
  id: number
  vehicle_identifier: string
  make: string
  model: string
  registration: string | null
}

export default function EditVehicleLocationPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
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
    async function fetchData() {
      const supabase = createClient()

      // Fetch only spare vehicles that are not off the road
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('id, vehicle_identifier, make, model, registration')
        .eq('spare_vehicle', true)
        .or('off_the_road.is.null,off_the_road.eq.false')
        .order('vehicle_identifier')

      if (vehiclesData) {
        setVehicles(vehiclesData)
      }

      // Fetch location
      const { data: locationData, error } = await supabase
        .from('vehicle_locations')
        .select('*')
        .eq('id', params.id)
        .single()

      if (!error && locationData) {
        setFormData({
          vehicle_id: locationData.vehicle_id?.toString() || '',
          location_name: locationData.location_name || '',
          address: locationData.address || '',
          latitude: locationData.latitude?.toString() || '',
          longitude: locationData.longitude?.toString() || '',
        })
      }

      setIsLoading(false)
    }
    fetchData()
  }, [params.id])

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

    setIsSaving(true)

    try {
      const supabase = createClient()

      const updateData: any = {
        vehicle_id: parseInt(formData.vehicle_id),
        location_name: formData.location_name.trim(),
        address: formData.address.trim() || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        last_updated: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('vehicle_locations')
        .update(updateData)
        .eq('id', params.id)

      if (error) throw error

      // Audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'vehicle_locations',
          record_id: parseInt(params.id),
          action: 'UPDATE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      startTransition(() => {
        router.push('/dashboard/vehicle-locations')
        router.refresh()
      })
    } catch (error: any) {
      console.error('Error updating vehicle location:', error)
      setErrors({ submit: error.message || 'Failed to update vehicle location' })
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Edit Spare Vehicle Location</h1>
          <p className="mt-2 text-sm text-gray-600">
            Update spare vehicle location information
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                disabled={isSaving}
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
                  disabled={isSaving}
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
                  disabled={isSaving}
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
                <Button type="button" variant="secondary" disabled={isSaving}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSaving || isPending}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving || isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

