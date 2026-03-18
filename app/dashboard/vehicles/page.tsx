import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Plus, Eye, Pencil, Car, AlertTriangle, ParkingCircle, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { VehicleSearchFilters } from './VehicleSearchFilters'
import { getVehicles, VehicleFilters } from '@/lib/supabase/vehicles'

async function VehiclesTable({
  filters
}: {
  filters: VehicleFilters
}) {
  const vehicles = await getVehicles(filters)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Vehicle Identifier</TableHead>
            <TableHead>Registration</TableHead>
            <TableHead>Make/Model</TableHead>
            <TableHead>Vehicle Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>MOT Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12">
                <Car className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No vehicles found</p>
                <p className="text-sm text-slate-400">Add your first vehicle to get started</p>
              </TableCell>
            </TableRow>
          ) : (
            vehicles.map((vehicle) => (
              <TableRow key={vehicle.id} className="hover:bg-slate-50">
                <TableCell className="text-slate-500">#{vehicle.id}</TableCell>
                <TableCell className="font-semibold text-slate-800">{vehicle.vehicle_identifier || 'N/A'}</TableCell>
                <TableCell className="text-slate-600">{vehicle.registration || 'N/A'}</TableCell>
                <TableCell className="text-slate-600">{`${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'N/A'}</TableCell>
                <TableCell className="text-slate-600">{vehicle.vehicle_type || 'N/A'}</TableCell>
                <TableCell>
                  {vehicle.off_the_road ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-rose-100 text-rose-700">
                      <AlertTriangle className="h-3 w-3" />
                      VOR
                    </span>
                  ) : vehicle.spare_vehicle ? (
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
                <TableCell className="text-slate-600">{formatDate(vehicle.mot_date)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/vehicles/${vehicle.id}`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/vehicles/${vehicle.id}/edit`} prefetch={true}>
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

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: {
    search?: string
    is_spare?: string
    is_vor?: string
    has_lift?: string
  }
}) {
  // Build filters from search params
  const filters: VehicleFilters = {
    search: searchParams.search || undefined,
    is_spare: (searchParams.is_spare as 'all' | 'yes' | 'no') || 'all',
    is_vor: (searchParams.is_vor as 'all' | 'yes' | 'no') || 'all',
    has_lift: (searchParams.has_lift as 'all' | 'yes' | 'no') || 'all',
  }

  // Create a unique key for Suspense based on all filter params
  const suspenseKey = JSON.stringify(filters)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Car className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Vehicles</h1>
            <p className="text-sm text-slate-500">Manage all vehicles in your fleet</p>
          </div>
        </div>
        <Link href="/dashboard/vehicles/create" prefetch={true}>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </Link>
      </div>

      {/* Search and Filter Controls */}
      <Suspense fallback={<div className="h-10 w-full max-w-2xl rounded-lg bg-slate-100 animate-pulse" />}>
        <VehicleSearchFilters />
      </Suspense>

      <Suspense key={suspenseKey} fallback={<TableSkeleton rows={5} columns={8} />}>
        <VehiclesTable filters={filters} />
      </Suspense>
    </div>
  )
}


