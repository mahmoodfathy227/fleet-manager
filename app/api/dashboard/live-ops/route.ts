import { NextRequest, NextResponse } from 'next/server'
import { getLiveOpsDashboardData } from '@/lib/samsara/dashboard-query-service'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const routeId = Number(searchParams.get('routeId'))
    const driverId = Number(searchParams.get('driverId'))
    const depotId = Number(searchParams.get('depotId'))

    const data = await getLiveOpsDashboardData({
      routeId: Number.isFinite(routeId) ? routeId : undefined,
      driverId: Number.isFinite(driverId) ? driverId : undefined,
      depotId: Number.isFinite(depotId) ? depotId : undefined,
    })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load live operations data' },
      { status: 500 }
    )
  }
}
