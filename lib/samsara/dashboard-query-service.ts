import { createServiceClient } from '@/lib/supabase/service'
import { getRealtimeSnapshotsForVehicles } from '@/lib/samsara/realtime-table-service'
import {
  getVehicleLocationFallbacks,
  type SupabaseLike,
} from '@/lib/samsara/location-fallback-service'
import { SamsaraApiClient } from '@/lib/samsara/client'
import { normalizeRegistration } from '@/lib/samsara/registration'

type LiveOpsFilters = {
  depotId?: number
  routeId?: number
  driverId?: number
}

function startOfDayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function todayDateValue() {
  return new Date().toISOString().slice(0, 10)
}

function startOfWeekIso() {
  const d = new Date()
  const day = d.getDay()
  const diff = (day + 6) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function getDirectSamsaraTelemetryByVehicleId(
  vehicles: Array<Record<string, unknown>>
): Promise<Map<number, Record<string, unknown>>> {
  if (vehicles.length === 0) {
    return new Map()
  }

  try {
    const samsaraClient = new SamsaraApiClient()
    const samsaraVehicles = await samsaraClient.listVehicles()

    const internalVehicleIdByKey = new Map<string, number>()
    for (const vehicle of vehicles) {
      const vehicleId = Number(vehicle.id)
      if (!Number.isFinite(vehicleId)) continue

      const keys = [
        normalizeRegistration(vehicle.registration as string | null),
        normalizeRegistration(vehicle.vehicle_identifier as string | null),
      ].filter(Boolean)

      for (const key of keys) {
        if (!internalVehicleIdByKey.has(key)) {
          internalVehicleIdByKey.set(key, vehicleId)
        }
      }
    }

    const samsaraIdToVehicleId = new Map<string, number>()
    for (const samsaraVehicle of samsaraVehicles) {
      const keys = [
        normalizeRegistration(samsaraVehicle.registration),
        normalizeRegistration(samsaraVehicle.licensePlate),
        normalizeRegistration(samsaraVehicle.name),
      ].filter(Boolean)

      const internalVehicleId = keys
        .map((key) => internalVehicleIdByKey.get(key))
        .find((value): value is number => Number.isFinite(value))

      if (internalVehicleId != null) {
        samsaraIdToVehicleId.set(samsaraVehicle.id, internalVehicleId)
      }
    }

    const telemetryRows = await samsaraClient.getVehicleTelemetry(
      Array.from(samsaraIdToVehicleId.keys())
    )

    const telemetryByVehicleId = new Map<number, Record<string, unknown>>()
    for (const telemetry of telemetryRows) {
      const vehicleId = samsaraIdToVehicleId.get(telemetry.samsaraVehicleId)
      if (!vehicleId) continue

      telemetryByVehicleId.set(vehicleId, {
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        heading: telemetry.heading,
        speed_kph: telemetry.speedKph,
        ignition_on: telemetry.ignitionOn,
        odometer_km: telemetry.odometerKm,
        fuel_used_liters: telemetry.fuelUsedLiters,
        telematics_timestamp: telemetry.telematicsTimestamp,
        formatted_location: null,
        data_source: 'samsara_direct',
      })
    }

    return telemetryByVehicleId
  } catch {
    return new Map()
  }
}

export async function getLiveOpsDashboardData(filters: LiveOpsFilters = {}) {
  const supabase = createServiceClient()
  const staleMinutes = Number(process.env.SAMSARA_STALE_MINUTES || 5)
  const staleCutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString()
  const todayStart = startOfDayIso()
  const todayDate = todayDateValue()
  const weekStart = startOfWeekIso()

  let activeSessionQuery = supabase
    .from('route_sessions')
    .select(`
      id,
      route_id,
      session_date,
      session_type,
      started_at,
      ended_at,
      driver_id,
      routes!inner (
        id,
        route_number,
        vehicle_id,
        driver_id,
        schools(name)
      )
    `)
    .eq('session_date', todayDate)
    .not('started_at', 'is', null)
    .is('ended_at', null)

  if (filters.routeId) activeSessionQuery = activeSessionQuery.eq('route_id', filters.routeId)
  if (filters.driverId) activeSessionQuery = activeSessionQuery.eq('driver_id', filters.driverId)

  const [{ data: activeSessions }, { data: completedTodaySessions }, { data: allVehicles }] =
    await Promise.all([
      activeSessionQuery,
      supabase
        .from('route_sessions')
        .select('id, route_id, session_date, session_type, started_at, ended_at')
        .gte('ended_at', todayStart)
        .not('ended_at', 'is', null),
      supabase
        .from('vehicles')
        .select('id, vehicle_identifier, registration, off_the_road, samsara_vehicle_id'),
    ])

  const activeRouteIds = (activeSessions || []).map((session) => session.route_id as number)
  const activeVehicleIds = (activeSessions || [])
    .map((session) => {
      const routeValue = session.routes as
        | { vehicle_id?: number }
        | Array<{ vehicle_id?: number }>
        | null
      const route = Array.isArray(routeValue) ? routeValue[0] : routeValue
      return route?.vehicle_id || null
    })
    .filter((id): id is number => Boolean(id))

  const [
    { data: telematicsRows },
    { data: routePoints },
    { data: historyToday },
    { data: historyWeek },
    locationFallbacks,
  ] =
    await Promise.all([
      supabase
        .from('vehicle_telematics_latest')
        .select('*')
        .order('telematics_timestamp', { ascending: false }),
      activeRouteIds.length > 0
        ? supabase
            .from('route_points')
            .select('id, route_id, point_name, stop_order, latitude, longitude')
            .in('route_id', activeRouteIds)
            .order('stop_order', { ascending: true })
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      supabase
        .from('vehicle_telematics_history')
        .select('vehicle_id, odometer_km, fuel_used_liters, telematics_timestamp')
        .gte('telematics_timestamp', todayStart)
        .order('telematics_timestamp', { ascending: true }),
      supabase
        .from('vehicle_telematics_history')
        .select('vehicle_id, odometer_km, fuel_used_liters, telematics_timestamp')
        .gte('telematics_timestamp', weekStart)
        .order('telematics_timestamp', { ascending: true }),
      getVehicleLocationFallbacks(
        supabase as unknown as SupabaseLike,
        (allVehicles || []).map((vehicle) => Number(vehicle.id))
      ),
    ])

  const telematicsByVehicleId = new Map(
    (telematicsRows || []).map((row) => [row.vehicle_id as number, row])
  )

  const realtimeMap = await getRealtimeSnapshotsForVehicles(
    (allVehicles || []).map((vehicle) => ({
      vehicleId: vehicle.id as number,
      samsaraVehicleId: (vehicle.samsara_vehicle_id as string | null) || null,
      registration: (vehicle.registration as string | null) || null,
      vehicleIdentifier: (vehicle.vehicle_identifier as string | null) || null,
    }))
  )

  const directSamsaraMap = await getDirectSamsaraTelemetryByVehicleId(
    (allVehicles || []) as Array<Record<string, unknown>>
  )

  const getTelematicsForVehicle = (vehicleId: number) => {
    const direct = directSamsaraMap.get(vehicleId)
    if (direct) return direct
    const realtime = realtimeMap.get(vehicleId)
    if (realtime) return realtime
    return telematicsByVehicleId.get(vehicleId) || locationFallbacks.get(vehicleId) || null
  }

  const activeRoutes = (activeSessions || []).map((session) => {
    const routeValue = session.routes as
      | {
          id: number
          route_number?: string | null
          vehicle_id?: number | null
          schools?: { name?: string } | Array<{ name?: string }> | null
        }
      | Array<{
          id: number
          route_number?: string | null
          vehicle_id?: number | null
          schools?: { name?: string } | Array<{ name?: string }> | null
        }>
      | null
    const route = Array.isArray(routeValue) ? routeValue[0] : routeValue
    const schoolValue = route?.schools
    const school = Array.isArray(schoolValue) ? schoolValue[0] : schoolValue
    const vehicleId = route?.vehicle_id || null
    const telematics = vehicleId ? getTelematicsForVehicle(vehicleId) : null
    const isStale = !telematics || String(telematics.telematics_timestamp) < staleCutoff

    return {
      sessionId: session.id,
      routeId: route?.id || session.route_id,
      routeNumber: route?.route_number || null,
      schoolName: school?.name || null,
      vehicleId,
      sessionType: session.session_type,
      startedAt: session.started_at,
      livePosition: telematics
        ? {
            latitude: telematics.latitude,
            longitude: telematics.longitude,
            heading: telematics.heading,
            speedKph: telematics.speed_kph,
            telematicsTimestamp: telematics.telematics_timestamp,
            stale: isStale,
          }
        : null,
    }
  })

  const enRouteVehicleIds = new Set(activeVehicleIds)
  const idleVehicles = (allVehicles || []).filter(
    (vehicle) => !enRouteVehicleIds.has(vehicle.id) && !vehicle.off_the_road
  )

  const vehiclesWithStaleLocation = (allVehicles || []).filter((vehicle) => {
    const telematics = getTelematicsForVehicle(vehicle.id as number)
    if (!telematics?.telematics_timestamp) return true
    return String(telematics.telematics_timestamp) < staleCutoff
  })

  const pointsByRouteId = new Map<number, Array<Record<string, unknown>>>()
  for (const point of routePoints || []) {
    const routeId = point.route_id as number
    const current = pointsByRouteId.get(routeId) || []
    current.push(point)
    pointsByRouteId.set(routeId, current)
  }

  function computeDistance(records: Array<Record<string, unknown>>): number {
    const grouped = new Map<number, number[]>()
    for (const row of records) {
      const vehicleId = Number(row.vehicle_id)
      const odometer = Number(row.odometer_km)
      if (!Number.isFinite(vehicleId) || !Number.isFinite(odometer)) continue
      const arr = grouped.get(vehicleId) || []
      arr.push(odometer)
      grouped.set(vehicleId, arr)
    }

    let total = 0
    for (const values of Array.from(grouped.values())) {
      if (values.length < 2) continue
      total += Math.max(...values) - Math.min(...values)
    }
    return Number(total.toFixed(2))
  }

  function computeFuel(records: Array<Record<string, unknown>>): number {
    const grouped = new Map<number, number[]>()
    for (const row of records) {
      const vehicleId = Number(row.vehicle_id)
      const fuel = Number(row.fuel_used_liters)
      if (!Number.isFinite(vehicleId) || !Number.isFinite(fuel)) continue
      const arr = grouped.get(vehicleId) || []
      arr.push(fuel)
      grouped.set(vehicleId, arr)
    }

    let total = 0
    for (const values of Array.from(grouped.values())) {
      if (values.length < 2) continue
      total += Math.max(...values) - Math.min(...values)
    }
    return Number(total.toFixed(2))
  }

  return {
    cards: {
      activeRoutes: activeRoutes.length,
      vehiclesOnRun: enRouteVehicleIds.size,
      vehiclesIdle: idleVehicles.length,
      noRecentLocationUpdate: vehiclesWithStaleLocation.length,
      totalMileageTodayKm: computeDistance(historyToday || []),
      totalMileageThisWeekKm: computeDistance(historyWeek || []),
      fuelUsedTodayLiters: computeFuel(historyToday || []),
      fuelUsedThisWeekLiters: computeFuel(historyWeek || []),
    },
    map: {
      activeRoutes: activeRoutes.map((route) => ({
        ...route,
        routePolyline:
          (pointsByRouteId.get(route.routeId) || [])
            .filter((point) => point.latitude != null && point.longitude != null)
            .map((point) => ({
              lat: Number(point.latitude),
              lng: Number(point.longitude),
            })) || [],
      })),
      enRouteVehicles: (allVehicles || [])
        .filter((vehicle) => enRouteVehicleIds.has(vehicle.id))
        .map((vehicle) => ({
          ...vehicle,
          status: 'assigned_vehicle',
          telematics: getTelematicsForVehicle(vehicle.id as number),
        })),
      idleVehicles: idleVehicles.map((vehicle) => ({
        ...vehicle,
        status: 'idle_vehicle',
        telematics: getTelematicsForVehicle(vehicle.id as number),
      })),
      completedRoutes: completedTodaySessions || [],
    },
    alerts: {
      activeRouteWithoutVehicle: activeRoutes.filter((route) => !route.vehicleId).length,
      routeNoRecentUpdate: activeRoutes.filter((route) => route.livePosition?.stale).length,
      assignedVehicleWithoutMapping: (allVehicles || []).filter(
        (vehicle) => enRouteVehicleIds.has(vehicle.id) && !vehicle.samsara_vehicle_id
      ).length,
      unmatchedSamsaraVehicles: null as number | null,
    },
  }
}
