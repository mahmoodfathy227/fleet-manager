import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const vehicleId = parseInt(params.id)

    if (isNaN(vehicleId)) {
      return NextResponse.json(
        { error: 'Invalid vehicle ID' },
        { status: 400 }
      )
    }

    // Fetch routes assigned to this vehicle
    const { data: routes, error } = await supabase
      .from('routes')
      .select(`
        id,
        route_number,
        am_start_time,
        pm_start_time,
        pm_start_time_friday,
        days_of_week,
        driver_id,
        schools (
          id,
          name
        )
      `)
      .eq('vehicle_id', vehicleId)
      .order('route_number', { ascending: true })

    if (error) {
      console.error('Error fetching routes:', error)
      return NextResponse.json(
        { error: 'Failed to fetch routes' },
        { status: 500 }
      )
    }

    // Fetch driver names — routes.driver_id = employees.id (no FK, manual join)
    const driverIdSet: Record<number, true> = {}
    for (const r of routes ?? []) {
      if ((r as any).driver_id) driverIdSet[(r as any).driver_id] = true
    }
    const driverIds = Object.keys(driverIdSet).map(Number)
    let driverMap: Record<number, { id: number; full_name: string }> = {}
    if (driverIds.length > 0) {
      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name')
        .in('id', driverIds)
      for (const emp of employees ?? []) {
        driverMap[(emp as any).id] = emp as any
      }
    }

    const enriched = (routes ?? []).map((r: any) => ({
      ...r,
      driver: r.driver_id ? (driverMap[r.driver_id] ?? null) : null,
    }))

    return NextResponse.json({ routes: enriched })
  } catch (error) {
    console.error('Error in routes API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

