import { createServiceClient } from '@/lib/supabase/service'

type RealtimeRow = {
  id: string
  name: string | null
  latitude: number | null
  longitude: number | null
  heading: number | null
  speed: number | null
  formatted_location: string | null
  location_time: string | null
  updated_at: string | null
}

type RealtimeSnapshot = {
  latitude: number | null
  longitude: number | null
  heading: number | null
  speed_kph: number | null
  telematics_timestamp: string | null
  formatted_location: string | null
  data_source: 'samsara_realtime'
}

type VehicleLookup = {
  vehicleId: number
  samsaraVehicleId: string | null
  registration?: string | null
  vehicleIdentifier?: string | null
}

function normalizeLookupValue(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return normalized || null
}

function mapRealtimeRowToSnapshot(row: RealtimeRow): RealtimeSnapshot {
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    heading: row.heading,
    speed_kph: row.speed,
    telematics_timestamp: row.location_time || row.updated_at,
    formatted_location: row.formatted_location,
    data_source: 'samsara_realtime',
  }
}

export async function getRealtimeSnapshotForVehicle(
  vehicleId: number
): Promise<RealtimeSnapshot | null> {
  const supabase = createServiceClient()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, samsara_vehicle_id, registration, vehicle_identifier')
    .eq('id', vehicleId)
    .maybeSingle()

  if (!vehicle) return null

  const results = await getRealtimeSnapshotsForVehicles([
    {
      vehicleId,
      samsaraVehicleId: vehicle.samsara_vehicle_id || null,
      registration: vehicle.registration || null,
      vehicleIdentifier: vehicle.vehicle_identifier || null,
    },
  ])

  return results.get(vehicleId) || null
}

export async function getRealtimeSnapshotsForVehicles(
  vehicleLookups: VehicleLookup[]
): Promise<Map<number, RealtimeSnapshot>> {
  const supabase = createServiceClient()
  const out = new Map<number, RealtimeSnapshot>()

  const valid = vehicleLookups.filter(
    (row): row is { vehicleId: number; samsaraVehicleId: string } => Boolean(row.samsaraVehicleId)
  )
  const needsNameMatch = vehicleLookups.some(
    (row) => !row.samsaraVehicleId && (row.registration || row.vehicleIdentifier)
  )
  if (valid.length === 0 && !needsNameMatch) return out

  const idList = valid.map((row) => row.samsaraVehicleId)
  const realtimeQuery = supabase
    .from('vehicles_realtime')
    .select('id, name, latitude, longitude, heading, speed, formatted_location, location_time, updated_at')

  const { data: rows, error } =
    idList.length > 0 && !needsNameMatch
      ? await realtimeQuery.in('id', idList)
      : await realtimeQuery.order('updated_at', { ascending: false })

  if (error || !rows) return out

  const rowBySamsaraId = new Map(
    (rows as RealtimeRow[]).map((row) => [row.id, row])
  )
  const rowByNormalizedName = new Map<string, RealtimeRow>()

  for (const row of rows as RealtimeRow[]) {
    const normalizedName = normalizeLookupValue(row.name)
    if (normalizedName && !rowByNormalizedName.has(normalizedName)) {
      rowByNormalizedName.set(normalizedName, row)
    }
  }

  for (const item of vehicleLookups) {
    const directRow = item.samsaraVehicleId ? rowBySamsaraId.get(item.samsaraVehicleId) : null
    const normalizedRegistration = normalizeLookupValue(item.registration)
    const normalizedIdentifier = normalizeLookupValue(item.vehicleIdentifier)
    const row =
      directRow ||
      (normalizedRegistration ? rowByNormalizedName.get(normalizedRegistration) : null) ||
      (normalizedIdentifier ? rowByNormalizedName.get(normalizedIdentifier) : null)

    if (!row) continue
    out.set(item.vehicleId, mapRealtimeRowToSnapshot(row))
  }

  return out
}
