import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Clone an existing seating plan (from any vehicle) to the target vehicle.
 * Deactivates any current plan on the target and creates a new active plan with copied seats.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetVehicleId } = await params
    const body = await request.json()
    const sourcePlanId = body.source_plan_id != null ? Number(body.source_plan_id) : null

    if (sourcePlanId == null || Number.isNaN(sourcePlanId)) {
      return NextResponse.json(
        { error: 'Missing or invalid source_plan_id' },
        { status: 400 }
      )
    }

    const targetId = parseInt(targetVehicleId, 10)
    if (Number.isNaN(targetId)) {
      return NextResponse.json(
        { error: 'Invalid vehicle id' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: sourcePlan, error: sourceError } = await supabase
      .from('vehicle_seating_plans')
      .select('*')
      .eq('id', sourcePlanId)
      .single()

    if (sourceError || !sourcePlan) {
      return NextResponse.json(
        { error: 'Source seating plan not found' },
        { status: 404 }
      )
    }

    if (sourcePlan.vehicle_id === targetId) {
      return NextResponse.json(
        { error: 'Source plan already belongs to this vehicle' },
        { status: 400 }
      )
    }

    const { data: sourceSeats } = await supabase
      .from('seating_plan_seats')
      .select('seat_number, seat_type, is_accessible, notes')
      .eq('seating_plan_id', sourcePlanId)

    await supabase
      .from('vehicle_seating_plans')
      .update({ is_active: false })
      .eq('vehicle_id', targetId)

    const { data: newPlan, error: insertPlanError } = await supabase
      .from('vehicle_seating_plans')
      .insert({
        vehicle_id: targetId,
        name: sourcePlan.name,
        total_capacity: sourcePlan.total_capacity,
        rows: sourcePlan.rows,
        seats_per_row: sourcePlan.seats_per_row,
        wheelchair_spaces: sourcePlan.wheelchair_spaces ?? 0,
        notes: sourcePlan.notes ?? null,
        is_active: true,
      })
      .select()
      .single()

    if (insertPlanError || !newPlan) {
      return NextResponse.json(
        { error: insertPlanError?.message ?? 'Failed to create seating plan' },
        { status: 500 }
      )
    }

    if (sourceSeats && sourceSeats.length > 0) {
      const seatsToInsert = sourceSeats.map((s: { seat_number: string; seat_type: string; is_accessible: boolean; notes: string | null }) => ({
        seating_plan_id: newPlan.id,
        seat_number: s.seat_number,
        seat_type: s.seat_type ?? 'standard',
        is_accessible: s.is_accessible ?? false,
        notes: s.notes ?? null,
      }))
      const { error: seatsError } = await supabase
        .from('seating_plan_seats')
        .insert(seatsToInsert)

      if (seatsError) {
        console.error('Error copying seats:', seatsError)
        // Plan was created; seats are optional metadata
      }
    }

    return NextResponse.json({ success: true, data: newPlan })
  } catch (error) {
    console.error('Error cloning seating plan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
