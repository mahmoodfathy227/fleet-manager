import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Car, Eye, Pencil, ParkingCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getVehicles } from '@/lib/supabase/vehicles'

export default async function SpareVehiclesPage() {
  const vehicles = await getVehicles({ is_spare: 'yes', is_vor: 'no' })

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
            <TableHead>MOT Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12">
                <ParkingCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No spare vehicles</p>
                <p className="text-sm text-slate-400">
                  Mark vehicles as &quot;Spare Vehicle&quot; in Vehicles → Edit to list them here
                </p>
                <Link href="/dashboard/vehicles" className="inline-block mt-3">
                  <Button variant="secondary" size="sm">View all vehicles</Button>
                </Link>
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
