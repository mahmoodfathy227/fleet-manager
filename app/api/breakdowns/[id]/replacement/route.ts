import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Get replacement vehicles for a breakdown
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get breakdown to find the vehicle_id
    const { data: breakdown, error: breakdownError } = await supabase
      .from('vehicle_breakdowns')
      .select('vehicle_id')
      .eq('id', parseInt(params.id))
      .single()

    if (breakdownError || !breakdown) {
      return NextResponse.json(
        { error: 'Breakdown not found' },
        { status: 404 }
      )
    }

    const { data, error } = await supabase.rpc('find_replacement_vehicle', {
      p_vehicle_id: breakdown.vehicle_id
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, vehicles: data || [] })
  } catch (error) {
    console.error('Error finding replacement vehicles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Assign replacement vehicle
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { replacement_vehicle_id } = body

    if (!replacement_vehicle_id) {
      return NextResponse.json(
        { error: 'replacement_vehicle_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc('assign_replacement_vehicle', {
      p_breakdown_id: parseInt(params.id),
      p_replacement_vehicle_id: replacement_vehicle_id
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, breakdown: data })
  } catch (error) {
    console.error('Error assigning replacement vehicle:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

