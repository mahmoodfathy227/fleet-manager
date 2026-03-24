export type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: number[]) => {
        order: (
          column: string,
          options: { ascending: boolean }
        ) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>
      }
      eq: (column: string, value: number) => {
        order: (
          column: string,
          options: { ascending: boolean }
        ) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>
      }
    }
  }
}

export type VehicleLocationFallback = {
  latitude: number | null
  longitude: number | null
  heading: number | null
  speed_kph: number | null
  ignition_on: boolean | null
  odometer_km: number | null
  fuel_used_liters: number | null
  telematics_timestamp: string | null
  data_source: 'vehicle_locations'
  formatted_location: string | null
}

function isMissingVehicleLocationsTableError(message: string | null | undefined): boolean {
  if (!message) return false
  return (
    message.includes("Could not find the table 'public.vehicle_locations'") ||
    message.includes("relation \"public.vehicle_locations\" does not exist") ||
    message.includes("relation \"vehicle_locations\" does not exist")
  )
}

function mapRowToFallback(row: Record<string, unknown>): VehicleLocationFallback {
  return {
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    heading: null,
    speed_kph: null,
    ignition_on: null,
    odometer_km: null,
    fuel_used_liters: null,
    telematics_timestamp: (row.last_updated as string | null) || null,
    data_source: 'vehicle_locations',
    formatted_location:
      (row.address as string | null) ||
      (row.location_name as string | null) ||
      null,
  }
}

export async function getVehicleLocationFallbacks(
  supabase: SupabaseLike,
  vehicleIds: number[]
): Promise<Map<number, VehicleLocationFallback>> {
  const uniqueVehicleIds = Array.from(new Set(vehicleIds.filter((id) => Number.isFinite(id))))
  if (uniqueVehicleIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('vehicle_locations')
    .select('vehicle_id, location_name, address, latitude, longitude, last_updated')
    .in('vehicle_id', uniqueVehicleIds)
    .order('last_updated', { ascending: false })

  if (error) {
    if (isMissingVehicleLocationsTableError(error.message)) {
      return new Map()
    }
    throw new Error(error.message)
  }

  const fallbackByVehicleId = new Map<number, VehicleLocationFallback>()
  for (const row of data || []) {
    const vehicleId = Number(row.vehicle_id)
    if (!Number.isFinite(vehicleId) || fallbackByVehicleId.has(vehicleId)) continue
    fallbackByVehicleId.set(vehicleId, mapRowToFallback(row))
  }

  return fallbackByVehicleId
}

export async function getVehicleLocationFallback(
  supabase: SupabaseLike,
  vehicleId: number
): Promise<VehicleLocationFallback | null> {
  const fallbackByVehicleId = await getVehicleLocationFallbacks(supabase, [vehicleId])
  return fallbackByVehicleId.get(vehicleId) || null
}
