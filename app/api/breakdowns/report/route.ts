import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { route_session_id, description, location } = body

    if (!route_session_id) {
      return NextResponse.json(
        { error: 'route_session_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc('report_vehicle_breakdown', {
      p_route_session_id: route_session_id,
      p_description: description || null,
      p_location: location || null
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, breakdown: data })
  } catch (error) {
    console.error('Error reporting breakdown:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

