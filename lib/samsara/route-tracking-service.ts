import { createClient } from '@/lib/supabase/server'
import { getRealtimeSnapshotForVehicle } from '@/lib/samsara/realtime-table-service'
import {
  getVehicleLocationFallback,
  type SupabaseLike,
} from '@/lib/samsara/location-fallback-service'

type Coordinate = { lat: number; lng: number }

function haversineMeters(a: Coordinate, b: Coordinate): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)

  return 2 * R * Math.asin(Math.sqrt(h))
}

function getClosestRoutePointIndex(current: Coordinate, points: Coordinate[]): number {
  let closestIdx = -1
  let closestDistance = Number.POSITIVE_INFINITY

  points.forEach((point, index) => {
    const distance = haversineMeters(current, point)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIdx = index
    }
  })

  return closestIdx
}

export async function getRouteLiveState(routeId: number) {
  const supabase = await createClient()
  const now = Date.now()
  const staleMinutes = Number(process.env.SAMSARA_STALE_MINUTES || 5)
  const offRouteMeters = Number(process.env.SAMSARA_OFF_ROUTE_METERS || 250)

  const [{ data: route }, { data: session }, { data: points }] = await Promise.all([
    supabase
      .from('routes')
      .select(`
        id,
        route_number,
        school_id,
        vehicle_id,
        driver_id,
        passenger_assistant_id,
        schools(name),
        vehicles(id, vehicle_identifier, registration, samsara_vehicle_id)
      `)
      .eq('id', routeId)
      .maybeSingle(),
    supabase
      .from('route_sessions')
      .select('id, route_id, session_date, session_type, started_at, ended_at, driver_id, passenger_assistant_id')
      .eq('route_id', routeId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('route_points')
      .select('id, point_name, stop_order, latitude, longitude')
      .eq('route_id', routeId)
      .order('stop_order', { ascending: true }),
  ])

  if (!route) return null

  const vehicleId = route.vehicle_id as number | null
  const routeStarted = Boolean(session?.started_at)
  const routeEnded = Boolean(session?.ended_at)
  const routeStatus = routeEnded ? 'completed' : routeStarted ? 'active' : 'not_started'

  let telematics: Record<string, unknown> | null = null
  if (vehicleId) {
    const realtime = await getRealtimeSnapshotForVehicle(vehicleId)
    if (realtime) {
      telematics = realtime as unknown as Record<string, unknown>
    } else {
      const { data } = await supabase
        .from('vehicle_telematics_latest')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .maybeSingle()
      telematics =
        data ||
        (await getVehicleLocationFallback(
          supabase as unknown as SupabaseLike,
          vehicleId
        ) as unknown as Record<string, unknown> | null)
    }
  }

  const telemetryAgeMs = telematics?.telematics_timestamp
    ? now - new Date(String(telematics.telematics_timestamp)).getTime()
    : null

  const stale = telemetryAgeMs == null ? true : telemetryAgeMs > staleMinutes * 60 * 1000

  const routeCoordinates: Coordinate[] = (points || [])
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) }))

  const currentPosition =
    telematics?.latitude != null && telematics?.longitude != null
      ? ({ lat: Number(telematics.latitude), lng: Number(telematics.longitude) } as Coordinate)
      : null

  const closestPointIndex =
    currentPosition && routeCoordinates.length > 0
      ? getClosestRoutePointIndex(currentPosition, routeCoordinates)
      : -1

  const progressPct =
    closestPointIndex >= 0 && routeCoordinates.length > 1
      ? Math.round((closestPointIndex / (routeCoordinates.length - 1)) * 100)
      : 0

  const distanceToClosestMeters =
    currentPosition && closestPointIndex >= 0
      ? haversineMeters(currentPosition, routeCoordinates[closestPointIndex])
      : null

  const offRoute =
    distanceToClosestMeters != null ? distanceToClosestMeters > offRouteMeters : false

  const schoolValue = route.schools as
    | { name?: string }
    | Array<{ name?: string }>
    | null
  const school = Array.isArray(schoolValue) ? schoolValue[0] : schoolValue
  const vehicleValue = route.vehicles as Record<string, unknown> | Array<Record<string, unknown>> | null
  const assignedVehicle = Array.isArray(vehicleValue) ? vehicleValue[0] : vehicleValue

  return {
    route: {
      id: route.id,
      routeNumber: route.route_number,
      school: school?.name ?? null,
      status: routeStatus,
      startedAt: session?.started_at ?? null,
      endedAt: session?.ended_at ?? null,
      sessionType: session?.session_type ?? null,
      assignedDriverId: session?.driver_id ?? route.driver_id ?? null,
      assignedPassengerAssistantId:
        session?.passenger_assistant_id ?? route.passenger_assistant_id ?? null,
    },
    assignedVehicle: assignedVehicle || null,
    telematics: telematics
      ? {
          latitude: telematics.latitude,
          longitude: telematics.longitude,
          heading: telematics.heading,
          speedKph: telematics.speed_kph,
          ignitionOn: telematics.ignition_on,
          odometerKm: telematics.odometer_km,
          fuelUsedLiters: telematics.fuel_used_liters,
          telematicsTimestamp: telematics.telematics_timestamp,
          stale,
          ageMs: telemetryAgeMs,
        }
      : null,
    progress: {
      percent: progressPct,
      closestPointIndex,
      distanceToClosestMeters,
      offRoute,
    },
    routePoints: points || [],
    routePolyline: routeCoordinates,
    eta: {
      status: 'placeholder',
      value: null as string | null,
    },
  }
}
