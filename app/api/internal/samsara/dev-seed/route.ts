import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hasAnyServerPermission } from '@/lib/auth/server-permissions'

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function jitter(value: number, spread: number) {
  return value + randomBetween(-spread, spread)
}

function toIsoWithoutZone(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '')
}

function isAuthorizedByToken(request: NextRequest): boolean {
  const expected = process.env.SAMSARA_SYNC_TOKEN
  if (!expected) return false
  const incoming = request.headers.get('x-sync-token')
  return Boolean(incoming && incoming === expected)
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const tokenAuthorized = isAuthorizedByToken(request)
  const permissionAuthorized = await hasAnyServerPermission([
    'users.manage',
    'roles.assign',
    'integrations.samsara.manage',
  ])

  return tokenAuthorized || permissionAuthorized
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Dev seed is disabled in production' }, { status: 403 })
    }

    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const vehicleCount = Math.max(1, Math.min(Number(body.vehicleCount || 8), 30))
    const activeRouteCount = Math.max(1, Math.min(Number(body.activeRouteCount || 4), 12))

    const supabase = createServiceClient()

    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, vehicle_identifier, registration, samsara_vehicle_id')
      .order('id', { ascending: true })
      .limit(vehicleCount)

    if (vehiclesError) {
      if (vehiclesError.message.includes('samsara_vehicle_id')) {
        return NextResponse.json(
          {
            error:
              'Database schema is missing Samsara columns. Apply migration: supabase/migrations/165_samsara_tracking_foundation.sql',
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: vehiclesError.message }, { status: 500 })
    }
    if (!vehicles || vehicles.length === 0) {
      return NextResponse.json({ error: 'No vehicles found to seed' }, { status: 400 })
    }

    for (const vehicle of vehicles) {
      if (!vehicle.samsara_vehicle_id) {
        await supabase
          .from('vehicles')
          .update({
            samsara_vehicle_id: `demo-samsara-${vehicle.id}`,
            samsara_last_mapping_sync_at: new Date().toISOString(),
          })
          .eq('id', vehicle.id)
      }
    }

    const { data: routesWithVehicles } = await supabase
      .from('routes')
      .select('id, route_number, vehicle_id')
      .not('vehicle_id', 'is', null)
      .limit(activeRouteCount * 2)

    const routes = (routesWithVehicles || []).slice(0, activeRouteCount)
    const now = new Date()

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i]
      if (!route.vehicle_id) continue

      const sessionDate = new Date(now)
      sessionDate.setDate(now.getDate() + i + 1)
      const sessionType = i % 2 === 0 ? 'AM' : 'PM'
      const startedAt = new Date(now.getTime() - (i + 1) * 12 * 60 * 1000)

      await supabase
        .from('route_sessions')
        .upsert(
          {
            route_id: route.id,
            session_date: sessionDate.toISOString().slice(0, 10),
            session_type: sessionType,
            started_at: startedAt.toISOString(),
            ended_at: null,
          },
          { onConflict: 'route_id,session_date,session_type' }
        )
    }

    const { data: vehicleWithRoutePoints } = await supabase
      .from('routes')
      .select('id, vehicle_id, route_points(latitude, longitude)')
      .in(
        'vehicle_id',
        vehicles.map((v) => v.id)
      )

    const centerByVehicleId = new Map<number, { lat: number; lng: number }>()
    for (const row of vehicleWithRoutePoints || []) {
      const routePoints = (row.route_points || []) as Array<{ latitude: number | null; longitude: number | null }>
      const first = routePoints.find((p) => p.latitude != null && p.longitude != null)
      if (first && row.vehicle_id) {
        centerByVehicleId.set(row.vehicle_id, { lat: Number(first.latitude), lng: Number(first.longitude) })
      }
    }

    const historyRows: Array<Record<string, unknown>> = []
    let realtimeSeeded = 0

    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i]
      const base = centerByVehicleId.get(vehicle.id) || { lat: 52.4862, lng: -1.8904 }
      const lat = jitter(base.lat, 0.03)
      const lng = jitter(base.lng, 0.03)
      const heading = randomBetween(0, 359)
      const speed = Number(randomBetween(12, 58).toFixed(1))
      const locationTime = new Date(now.getTime() - i * 40000)
      const odometer = Number((14000 + i * 220 + randomBetween(0, 50)).toFixed(2))
      const fuel = Number((300 + i * 14 + randomBetween(0, 8)).toFixed(2))
      const samsaraVehicleId = vehicle.samsara_vehicle_id || `demo-samsara-${vehicle.id}`

      await supabase
        .from('vehicles_realtime')
        .upsert(
          {
            id: samsaraVehicleId,
            vehicle_db_id: vehicle.id,
            name: vehicle.vehicle_identifier || vehicle.registration || `Vehicle ${vehicle.id}`,
            latitude: lat,
            longitude: lng,
            heading,
            speed,
            formatted_location: `Demo location near ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            location_time: toIsoWithoutZone(locationTime),
            updated_at: toIsoWithoutZone(new Date()),
          },
          { onConflict: 'id' }
        )

      await supabase
        .from('vehicle_telematics_latest')
        .upsert(
          {
            vehicle_id: vehicle.id,
            samsara_vehicle_id: samsaraVehicleId,
            latitude: lat,
            longitude: lng,
            heading,
            speed_kph: speed,
            ignition_on: true,
            odometer_km: odometer,
            fuel_used_liters: fuel,
            telematics_timestamp: locationTime.toISOString(),
            last_sync_at: new Date().toISOString(),
            data_source: 'samsara',
            raw_payload: {
              demo: true,
              source: 'dev-seed',
            },
          },
          { onConflict: 'vehicle_id' }
        )

      for (let j = 0; j < 10; j++) {
        const pointTime = new Date(now.getTime() - j * 60 * 60 * 1000)
        historyRows.push({
          vehicle_id: vehicle.id,
          samsara_vehicle_id: samsaraVehicleId,
          latitude: jitter(lat, 0.008),
          longitude: jitter(lng, 0.008),
          heading: jitter(heading, 25),
          speed_kph: Number(randomBetween(6, 55).toFixed(2)),
          ignition_on: true,
          odometer_km: Number((odometer - j * randomBetween(2, 8)).toFixed(2)),
          fuel_used_liters: Number((fuel - j * randomBetween(0.5, 2)).toFixed(2)),
          telematics_timestamp: pointTime.toISOString(),
          synced_at: pointTime.toISOString(),
          raw_payload: {
            demo: true,
            source: 'dev-seed-history',
          },
        })
      }

      realtimeSeeded += 1
    }

    if (historyRows.length > 0) {
      await supabase.from('vehicle_telematics_history').insert(historyRows)
    }

    return NextResponse.json({
      success: true,
      message: 'Dummy Samsara tracking data seeded',
      seeded: {
        vehiclesUpdated: vehicles.length,
        realtimeRows: realtimeSeeded,
        historyRows: historyRows.length,
        activeRoutes: routes.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed dummy data' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Dev seed cleanup is disabled in production' }, { status: 403 })
    }

    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    const { data: demoVehicles, error: demoVehiclesError } = await supabase
      .from('vehicles')
      .select('id, samsara_vehicle_id')
      .like('samsara_vehicle_id', 'demo-samsara-%')

    if (demoVehiclesError) {
      return NextResponse.json({ error: demoVehiclesError.message }, { status: 500 })
    }

    const demoVehicleIds = (demoVehicles || []).map((vehicle) => vehicle.id)
    const demoSamsaraIds = (demoVehicles || [])
      .map((vehicle) => vehicle.samsara_vehicle_id)
      .filter((value): value is string => Boolean(value))

    const counts = {
      vehicleMappingsCleared: 0,
      realtimeRowsDeleted: 0,
      latestRowsDeleted: 0,
      historyRowsDeleted: 0,
      routeSessionsDeleted: 0,
    }

    if (demoSamsaraIds.length > 0) {
      const { count, error } = await supabase
        .from('vehicles_realtime')
        .delete({ count: 'exact' })
        .in('id', demoSamsaraIds)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      counts.realtimeRowsDeleted = count || 0
    }

    {
      const { count, error } = await supabase
        .from('vehicle_telematics_latest')
        .delete({ count: 'exact' })
        .contains('raw_payload', { demo: true })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      counts.latestRowsDeleted = count || 0
    }

    {
      const { count, error } = await supabase
        .from('vehicle_telematics_history')
        .delete({ count: 'exact' })
        .contains('raw_payload', { demo: true })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      counts.historyRowsDeleted = count || 0
    }

    if (demoVehicleIds.length > 0) {
      const { data: demoRoutes, error: demoRoutesError } = await supabase
        .from('routes')
        .select('id')
        .in('vehicle_id', demoVehicleIds)

      if (demoRoutesError) {
        return NextResponse.json({ error: demoRoutesError.message }, { status: 500 })
      }

      const demoRouteIds = (demoRoutes || []).map((route) => route.id)
      if (demoRouteIds.length > 0) {
        const { data: demoRouteSessions, error: demoRouteSessionsError } = await supabase
          .from('route_sessions')
          .select('id')
          .in('route_id', demoRouteIds)
          .gt('session_date', today)
          .not('started_at', 'is', null)
          .is('ended_at', null)

        if (demoRouteSessionsError) {
          return NextResponse.json({ error: demoRouteSessionsError.message }, { status: 500 })
        }

        const demoRouteSessionIds = (demoRouteSessions || []).map((session) => session.id)
        if (demoRouteSessionIds.length > 0) {
          const { count, error } = await supabase
            .from('route_sessions')
            .delete({ count: 'exact' })
            .in('id', demoRouteSessionIds)

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
          }
          counts.routeSessionsDeleted = count || 0
        }
      }
    }

    if (demoVehicleIds.length > 0) {
      const { data, error } = await supabase
        .from('vehicles')
        .update({
          samsara_vehicle_id: null,
          samsara_last_mapping_sync_at: null,
        })
        .in('id', demoVehicleIds)
        .select('id')

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      counts.vehicleMappingsCleared = data?.length || 0
    }

    return NextResponse.json({
      success: true,
      message: 'Dummy Samsara tracking data removed',
      removed: counts,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove dummy data' },
      { status: 500 }
    )
  }
}
