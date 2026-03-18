import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Pencil, MapPin, Clock } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { notFound } from 'next/navigation'

async function getVehicleLocation(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicle_locations')
    .select(`
      *,
      vehicles (
        id,
        vehicle_identifier,
        make,
        model,
        registration,
        spare_vehicle,
        off_the_road,
        vehicle_type
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

export default async function VehicleLocationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const location = await getVehicleLocation(params.id)

  if (!location) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Spare Vehicle Location Details</h1>
          <p className="mt-2 text-sm text-gray-600">
            View detailed information about this spare vehicle location
          </p>
        </div>
        <div className="flex space-x-2">
          <Link href="/dashboard/vehicle-locations" prefetch={true}>
            <Button variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to List
            </Button>
          </Link>
          <Link href={`/dashboard/vehicle-locations/${params.id}/edit`} prefetch={true}>
            <Button>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vehicle Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-navy">
              <MapPin className="mr-2 h-5 w-5" />
              Vehicle Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Vehicle Identifier</p>
              <p className="mt-1 text-lg font-semibold">
                {location.vehicles?.vehicle_identifier || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Make & Model</p>
              <p className="mt-1">
                {location.vehicles?.make} {location.vehicles?.model}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Registration</p>
              <p className="mt-1">{location.vehicles?.registration || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Vehicle Type</p>
              <p className="mt-1">{location.vehicles?.vehicle_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <div className="mt-1 flex gap-2">
                {/* Always show "Spare" since this feature is for spare vehicles only */}
                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                  Spare Available
                </span>
                {location.vehicles?.off_the_road && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                    VOR
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-navy">
              <MapPin className="mr-2 h-5 w-5" />
              Location Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Location Name</p>
              <p className="mt-1 text-lg font-semibold">{location.location_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Address</p>
              <p className="mt-1">{location.address || 'No address provided'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Coordinates</p>
              {location.latitude && location.longitude ? (
                <div className="mt-1 font-mono text-sm">
                  <p>Latitude: {location.latitude}°</p>
                  <p>Longitude: {location.longitude}°</p>
                  <a
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center text-navy hover:underline"
                  >
                    View on Google Maps →
                  </a>
                </div>
              ) : (
                <p className="mt-1 text-gray-400">No coordinates available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-navy">
            <Clock className="mr-2 h-5 w-5" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Last Updated</p>
              <p className="mt-1">{formatDateTime(location.last_updated)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Created At</p>
              <p className="mt-1">{formatDateTime(location.created_at)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Modified At</p>
              <p className="mt-1">{formatDateTime(location.updated_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

