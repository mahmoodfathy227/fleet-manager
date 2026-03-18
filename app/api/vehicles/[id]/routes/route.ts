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

    return NextResponse.json({ routes: routes || [] })
  } catch (error) {
    console.error('Error in routes API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

