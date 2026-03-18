import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'

const VehicleDetailClient = dynamic(() => import('./VehicleDetailClient'), { ssr: false })

async function getVehicle(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .select(`
      *,
      assigned_employee:assigned_to (
        id,
        full_name
      ),
      taxi_licence_holder_employee:taxi_licence_holder_id (
        id,
        full_name
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

export default async function ViewVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const vehicle = await getVehicle(id)

  if (!vehicle) {
    notFound()
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      <VehicleDetailClient vehicle={vehicle} vehicleId={vehicle.id} />
    </div>
  )
}


