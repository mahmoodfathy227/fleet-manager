import { NextRequest, NextResponse } from 'next/server'
import { updateSeatingPlan } from '@/lib/supabase/vehicleSeating'
import { SeatingPlanInput } from '@/lib/types'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    // Validate input
    const planData: SeatingPlanInput = {
      name: body.name,
      total_capacity: parseInt(body.total_capacity),
      rows: parseInt(body.rows),
      seats_per_row: parseInt(body.seats_per_row),
      wheelchair_spaces: parseInt(body.wheelchair_spaces),
      notes: body.notes || null
    }

    // Validate required fields
    if (!planData.name || !planData.total_capacity || !planData.rows || !planData.seats_per_row) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate positive numbers
    if (planData.total_capacity <= 0 || planData.rows <= 0 || planData.seats_per_row <= 0) {
      return NextResponse.json(
        { error: 'Capacity, rows, and seats per row must be positive numbers' },
        { status: 400 }
      )
    }

    if (planData.wheelchair_spaces < 0) {
      return NextResponse.json(
        { error: 'Wheelchair spaces cannot be negative' },
        { status: 400 }
      )
    }

    // Update seating plan
    const result = await updateSeatingPlan(params.id, planData)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update seating plan' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data 
    })
  } catch (error) {
    console.error('Error in seating plan API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

