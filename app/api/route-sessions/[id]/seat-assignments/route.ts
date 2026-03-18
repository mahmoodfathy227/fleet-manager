import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Get all seat assignments for a route session
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase.rpc('get_route_session_seating', {
      p_route_session_id: parseInt(params.id)
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, assignments: data || [] })
  } catch (error) {
    console.error('Error fetching seat assignments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Assign a passenger to a seat
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { passenger_id, seat_number, seat_type, notes } = body

    if (!passenger_id || !seat_number) {
      return NextResponse.json(
        { error: 'passenger_id and seat_number are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc('assign_passenger_to_seat', {
      p_route_session_id: parseInt(params.id),
      p_passenger_id: passenger_id,
      p_seat_number: seat_number,
      p_seat_type: seat_type || 'standard',
      p_notes: notes || null
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, assignment: data })
  } catch (error) {
    console.error('Error assigning seat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Unassign a passenger from their seat
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const passengerId = searchParams.get('passenger_id')

    if (!passengerId) {
      return NextResponse.json(
        { error: 'passenger_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc('unassign_passenger_seat', {
      p_route_session_id: parseInt(params.id),
      p_passenger_id: parseInt(passengerId)
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, unassigned: data })
  } catch (error) {
    console.error('Error unassigning seat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

