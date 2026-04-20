import { createServiceClient } from '@/lib/supabase/service'
import { getRealtimeSnapshotsForVehicles } from '@/lib/samsara/realtime-table-service'
import {
  getVehicleLocationFallbacks,
  type SupabaseLike,
} from '@/lib/samsara/location-fallback-service'

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

  // All sessions today (started or not) — used to match vehicles to their scheduled route
  const scheduledSessionQuery = supabase
    .from('route_sessions')
    .select('id, route_id, session_type, started_at, routes!inner(id, route_number, vehicle_id)')
    .eq('session_date', todayDate)
    .is('ended_at', null)

  if (filters.routeId) activeSessionQuery = activeSessionQuery.eq('route_id', filters.routeId)
  if (filters.driverId) activeSessionQuery = activeSessionQuery.eq('driver_id', filters.driverId)

  const [{ data: activeSessions }, { data: completedTodaySessions }, { data: allVehicles }, { data: scheduledSessions }] =
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
      scheduledSessionQuery,
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
    { data: routePoints },
    { data: historyToday },
    { data: historyWeek },
    locationFallbacks,
  ] =
    await Promise.all([
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

  const realtimeMap = await getRealtimeSnapshotsForVehicles(
    (allVehicles || []).map((vehicle) => ({
      vehicleId: vehicle.id as number,
      samsaraVehicleId: (vehicle.samsara_vehicle_id as string | null) || null,
      registration: (vehicle.registration as string | null) || null,
      vehicleIdentifier: (vehicle.vehicle_identifier as string | null) || null,
    }))
  )

  const getTelematicsForVehicle = (vehicleId: number) => {
    const realtime = realtimeMap.get(vehicleId)
    if (realtime) return realtime
    return locationFallbacks.get(vehicleId) || null
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

  // Map vehicle_id → scheduled (but not-yet-started) session for today
  const scheduledRouteByVehicleId = new Map<number, { sessionId: number; routeId: number; routeNumber: string | null; sessionType: string | null; started: boolean }>()
  for (const s of scheduledSessions || []) {
    const r = Array.isArray(s.routes) ? s.routes[0] : s.routes as { id: number; route_number?: string | null; vehicle_id?: number | null } | null
    if (!r?.vehicle_id) continue
    const vehicleId = Number(r.vehicle_id)
    if (!scheduledRouteByVehicleId.has(vehicleId)) {
      scheduledRouteByVehicleId.set(vehicleId, {
        sessionId: s.id as number,
        routeId: r.id,
        routeNumber: r.route_number ?? null,
        sessionType: s.session_type as string | null,
        started: Boolean((s as { started_at?: unknown }).started_at),
      })
    }
  }
  const idleVehicles = (allVehicles || []).filter(
    (vehicle) => !enRouteVehicleIds.has(vehicle.id) && !vehicle.off_the_road
  )

  // Samsara-based engine state counts (from vehicles_realtime only — accurate)
  // Only vehicles with a samsara_vehicle_id are Samsara-tracked; others have no tracker at all
  let vehiclesMovingCount = 0
  let vehiclesIdlingCount = 0
  let vehiclesEngineOffCount = 0
  let vehiclesNoSignalCount = 0
  for (const vehicle of allVehicles || []) {
    if (vehicle.off_the_road) continue
    if (!vehicle.samsara_vehicle_id) continue  // no tracker fitted — exclude from all counts
    const rt = realtimeMap.get(vehicle.id as number)
    if (!rt) {
      vehiclesNoSignalCount++
      continue
    }
    // Treat stale data (>5 min) as No Signal — matches the gray marker on the map
    const isStale = !rt.telematics_timestamp || String(rt.telematics_timestamp) < staleCutoff
    if (isStale) {
      vehiclesNoSignalCount++
      continue
    }
    const engineState = rt.engine_state
    const speed = Number(rt.speed_kph ?? 0)
    if (engineState === 'On' && speed > 3) vehiclesMovingCount++
    else if (engineState === 'On') vehiclesIdlingCount++
    else vehiclesEngineOffCount++
  }

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
      vehiclesMoving: vehiclesMovingCount,
      vehiclesIdling: vehiclesIdlingCount,
      vehiclesEngineOff: vehiclesEngineOffCount,
      vehiclesNoSignal: vehiclesNoSignalCount,
      scheduledRoutesToday: (scheduledSessions || []).length,
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
        scheduledRoute: scheduledRouteByVehicleId.get(vehicle.id as number) ?? null,
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
