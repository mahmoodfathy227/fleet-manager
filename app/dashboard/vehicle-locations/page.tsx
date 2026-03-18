import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Plus, Eye, Pencil, MapPin, Map, AlertTriangle, ParkingCircle, CheckCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { VehicleLocationsMap } from '@/components/maps/VehicleLocationsMap'

async function getVehicleLocations() {
  const supabase = await createClient()

  // Fetch all vehicle locations
  const { data, error } = await supabase
    .from('vehicle_locations')
    .select(`
      *,
      vehicles!inner (
        id,
        vehicle_identifier,
        make,
        model,
        registration,
        spare_vehicle,
        off_the_road
      )
    `)
    .order('last_updated', { ascending: false })

  if (error) {
    console.error('Error fetching vehicle locations:', error)
    return []
  }

  return data || []
}

async function VehicleLocationsTable() {
  const locations = await getVehicleLocations()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vehicle</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Location Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Coordinates</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12">
                <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No vehicle locations found</p>
                <p className="text-sm text-slate-400">Add your first vehicle location to get started</p>
              </TableCell>
            </TableRow>
          ) : (
            locations.map((location: any) => (
              <TableRow key={location.id} className="hover:bg-slate-50">
                <TableCell>
                  <div>
                    <div className="font-semibold text-slate-800">
                      {location.vehicles?.vehicle_identifier || 'N/A'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {location.vehicles?.make} {location.vehicles?.model}
                    </div>
                    <div className="text-xs text-slate-400">
                      {location.vehicles?.registration || 'No reg'}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {location.vehicles?.off_the_road ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-rose-100 text-rose-700">
                      <AlertTriangle className="h-3 w-3" />
                      VOR
                    </span>
                  ) : location.vehicles?.spare_vehicle ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-700">
                      <ParkingCircle className="h-3 w-3" />
                      Spare
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <MapPin className="mr-2 h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-800">{location.location_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-xs truncate text-sm text-slate-600">
                    {location.address || 'No address'}
                  </div>
                </TableCell>
                <TableCell>
                  {location.latitude && location.longitude ? (
                    <div className="text-xs font-mono text-slate-500">
                      <div>{location.latitude}°N</div>
                      <div>{location.longitude}°E</div>
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">No coordinates</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm text-slate-600">{formatDateTime(location.last_updated)}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/vehicle-locations/${location.id}`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/vehicle-locations/${location.id}/edit`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function VehicleLocationsPage() {
  const locations = await getVehicleLocations()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ''

  // Debug: Log if key is missing (only in development)
  if (!apiKey && process.env.NODE_ENV === 'development') {
    console.warn('⚠️ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set or is empty')
    console.warn('Please check your .env.local file and restart the dev server')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
            <MapPin className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vehicle Locations</h1>
            <p className="text-sm text-slate-500">Track and manage locations for all vehicles in your fleet</p>
          </div>
        </div>
        <Link href="/dashboard/vehicle-locations/create" prefetch={true}>
          <Button className="bg-primary hover:bg-primary/90 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle Location
          </Button>
        </Link>
      </div>

      {/* Map View */}
      {locations.length > 0 && (
        <Card className="overflow-hidden border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-200">
            <CardTitle className="flex items-center text-slate-900 text-base font-semibold">
              <Map className="mr-2 h-5 w-5 text-slate-500" />
              Vehicle Locations Map View
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {apiKey ? (
              <VehicleLocationsMap locations={locations} apiKey={apiKey} />
            ) : (
              <div className="h-[600px] rounded-lg border bg-yellow-50 flex items-center justify-center">
                <div className="text-center text-yellow-800 p-4 max-w-md">
                  <p className="font-medium mb-2">⚠️ Google Maps API Key Not Found</p>
                  <p className="text-sm mb-3">
                    Please add <code className="bg-yellow-100 px-2 py-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your environment file.
                  </p>
                  <div className="text-xs text-left bg-yellow-100 p-3 rounded space-y-1">
                    <p className="font-semibold mb-2">Troubleshooting:</p>
                    <p>1. Ensure the variable is in <code className="font-mono">.env.local</code> in the project root</p>
                    <p>2. Variable name must be exactly: <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code></p>
                    <p>3. <strong>Restart your Next.js dev server</strong> after adding/changing env variables</p>
                    <p>4. Check for any extra spaces or quotes around the value</p>
                    <p>5. Format: <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here</code></p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table View */}
      <Suspense fallback={
        <TableSkeleton
          rows={8}
          columns={7}
          headers={['Vehicle', 'Status', 'Location Name', 'Address', 'Coordinates', 'Last Updated', 'Actions']}
        />
      }>
        <VehicleLocationsTable />
      </Suspense>
    </div>
  )
}

