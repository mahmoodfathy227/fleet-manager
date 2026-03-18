import { NextRequest, NextResponse } from 'next/server'
import { findSubstitutionVehicles } from '@/lib/supabase/vehicleSeating'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await findSubstitutionVehicles(params.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to find substitution vehicles' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data 
    })
  } catch (error) {
    console.error('Error in substitution vehicles API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

