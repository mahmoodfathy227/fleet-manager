import { NextRequest, NextResponse } from 'next/server'
import { getVehicleSeatingPlan } from '@/lib/supabase/vehicleSeating'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const seatingPlan = await getVehicleSeatingPlan(id)
    return NextResponse.json({ success: true, seatingPlan: seatingPlan ?? null })
  } catch (error) {
    console.error('Error in seating plan API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', seatingPlan: null },
      { status: 500 }
    )
  }
}

