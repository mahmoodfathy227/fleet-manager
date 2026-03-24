import { NextResponse } from 'next/server'
import { getVehicleTelematicsState } from '@/lib/samsara/vehicle-tracking-service'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const vehicleId = Number(params.id)
    if (!Number.isFinite(vehicleId)) {
      return NextResponse.json({ error: 'Invalid vehicle ID' }, { status: 400 })
    }

    const data = await getVehicleTelematicsState(vehicleId)
    if (!data) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load vehicle telematics' },
      { status: 500 }
    )
  }
}
