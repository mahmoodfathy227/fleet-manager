import { NextResponse } from 'next/server'
import { getRouteLiveState } from '@/lib/samsara/route-tracking-service'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const routeId = Number(params.id)
    if (!Number.isFinite(routeId)) {
      return NextResponse.json({ error: 'Invalid route ID' }, { status: 400 })
    }

    const data = await getRouteLiveState(routeId)
    if (!data) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load live route data' },
      { status: 500 }
    )
  }
}
