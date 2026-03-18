import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Car } from 'lucide-react'
import VehicleSeatingClient from './VehicleSeatingClient'
import { getVehicleSeatingPlan } from '@/lib/supabase/vehicleSeating'

interface VehicleSeatingPageProps {
  params: Promise<{ id: string }>
}

async function getVehicle(id: string) {
  const supabase = await createClient()

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .select('id, registration, make, model, vehicle_identifier')
    .eq('id', id)
    .single()

  if (error || !vehicle) {
    return null
  }

  return vehicle
}

export default async function VehicleSeatingPage({ params }: VehicleSeatingPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get vehicle details
  const vehicle = await getVehicle(id)
  if (!vehicle) {
    notFound()
  }

  // Get seating plan (null if none - no error)
  const seatingPlan = await getVehicleSeatingPlan(id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/vehicles/${id}`}>
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Car className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Seating Plan
            </h1>
            <p className="text-sm text-slate-500">
              {vehicle.make} {vehicle.model} • {vehicle.registration || vehicle.vehicle_identifier}
            </p>
          </div>
        </div>
      </div>

      {/* Client component for interactive features */}
      <VehicleSeatingClient
        vehicleId={id}
        vehicle={vehicle}
        initialSeatingPlan={seatingPlan}
      />
    </div>
  )
}

