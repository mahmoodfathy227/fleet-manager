import { createClient } from '@/lib/supabase/server'
import { getRealtimeSnapshotForVehicle } from '@/lib/samsara/realtime-table-service'
import {
  getVehicleLocationFallback,
  type SupabaseLike,
} from '@/lib/samsara/location-fallback-service'

function resolveFormattedLocation(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null
  const candidate = row as {
    formatted_location?: unknown
    raw_payload?: {
      gps?: {
        reverseGeo?: {
          formattedLocation?: unknown
        }
      }
    }
  }

  const direct = candidate.formatted_location
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct
  }

  const fromPayload = candidate.raw_payload?.gps?.reverseGeo?.formattedLocation
  if (typeof fromPayload === 'string' && fromPayload.trim().length > 0) {
    return fromPayload
  }

  return null
}

export async function getVehicleTelematicsState(vehicleId: number) {
  const supabase = await createClient()
  const staleMinutes = Number(process.env.SAMSARA_STALE_MINUTES || 5)
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000)

  const [{ data: vehicle }, { data: latest }, { data: lastKnown }, { data: activeSession }, locationFallback] =
    await Promise.all([
      supabase
        .from('vehicles')
        .select('id, vehicle_identifier, registration, samsara_vehicle_id')
        .eq('id', vehicleId)
        .maybeSingle(),
      supabase
        .from('vehicle_telematics_latest')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .maybeSingle(),
      supabase
        .from('vehicle_telematics_history')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('telematics_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('route_sessions')
        .select(`
          id,
          route_id,
          session_type,
          started_at,
          ended_at,
          routes!inner(id, route_number, vehicle_id)
        `)
        .is('ended_at', null)
        .not('started_at', 'is', null)
        .order('started_at', { ascending: false })
        .limit(20),
      getVehicleLocationFallback(supabase as unknown as SupabaseLike, vehicleId),
    ])

  if (!vehicle) return null

  const activeRoute = (activeSession || []).find((row) => {
    const routeValue = row.routes as { vehicle_id?: number } | Array<{ vehicle_id?: number }> | null
    const route = Array.isArray(routeValue) ? routeValue[0] : routeValue
    return route?.vehicle_id === vehicleId
  })

  const realtime = await getRealtimeSnapshotForVehicle(vehicleId)
  const preferredLatest = realtime || latest

  const timestamp = preferredLatest?.telematics_timestamp
    ? new Date(String(preferredLatest.telematics_timestamp))
    : null

  const isStale = !timestamp || timestamp < staleCutoff

  return {
    vehicle,
    live: preferredLatest
      ? {
          latitude: preferredLatest.latitude,
          longitude: preferredLatest.longitude,
          heading: preferredLatest.heading,
          speedKph: preferredLatest.speed_kph,
          ignitionOn: preferredLatest.ignition_on,
          odometerKm: preferredLatest.odometer_km,
          fuelUsedLiters: preferredLatest.fuel_used_liters,
          formattedLocation: resolveFormattedLocation(preferredLatest),
          updatedAt: preferredLatest.telematics_timestamp,
          stale: isStale,
          dataSource: preferredLatest.data_source || 'samsara_cached',
        }
      : null,
    lastKnown: lastKnown
      ? {
          latitude: lastKnown.latitude,
          longitude: lastKnown.longitude,
          heading: lastKnown.heading,
          speedKph: lastKnown.speed_kph,
          ignitionOn: lastKnown.ignition_on,
          odometerKm: lastKnown.odometer_km,
          fuelUsedLiters: lastKnown.fuel_used_liters,
          formattedLocation: resolveFormattedLocation(lastKnown),
          updatedAt: lastKnown.telematics_timestamp,
        }
      : locationFallback
        ? {
            latitude: locationFallback.latitude,
            longitude: locationFallback.longitude,
            heading: locationFallback.heading,
            speedKph: locationFallback.speed_kph,
            ignitionOn: locationFallback.ignition_on,
            odometerKm: locationFallback.odometer_km,
            fuelUsedLiters: locationFallback.fuel_used_liters,
            formattedLocation: locationFallback.formatted_location,
            updatedAt: locationFallback.telematics_timestamp,
          }
      : null,
    activeRoute: activeRoute
      ? {
          sessionId: activeRoute.id,
          routeId: activeRoute.route_id,
          sessionType: activeRoute.session_type,
          startedAt: activeRoute.started_at,
          routeNumber: (() => {
            const routeValue = activeRoute.routes as
              | { route_number?: string | null }
              | Array<{ route_number?: string | null }>
              | null
            const route = Array.isArray(routeValue) ? routeValue[0] : routeValue
            return route?.route_number || null
          })(),
          status: 'active',
        }
      : null,
  }
}
