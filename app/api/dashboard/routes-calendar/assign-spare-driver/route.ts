import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** UTC [start, end) covering the calendar date (aligns with route_sessions.session_date). */
function utcDayBoundsIso(sessionDate: string): { starts_at: string; ends_at: string } {
  const [y, m, d] = sessionDate.split('-').map(Number)
  if (!y || !m || !d || sessionDate.length < 10) {
    throw new Error('Invalid sessionDate')
  }
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0))
  return { starts_at: start.toISOString(), ends_at: end.toISOString() }
}

/** POST { routeId, spareDriverEmployeeId, sessionDate (YYYY-MM-DD), reason? } — spare for that calendar day only */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { routeId: number; spareDriverEmployeeId: number; sessionDate: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { routeId, spareDriverEmployeeId, sessionDate, reason } = body
  if (!routeId || !spareDriverEmployeeId) {
    return NextResponse.json({ error: 'routeId and spareDriverEmployeeId required' }, { status: 400 })
  }
  if (!sessionDate || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    return NextResponse.json({ error: 'sessionDate (YYYY-MM-DD) required' }, { status: 400 })
  }

  try {
    const { starts_at, ends_at } = utcDayBoundsIso(sessionDate)

    const { data: spareCheck } = await supabase
      .from('drivers')
      .select('employee_id, spare_driver')
      .eq('employee_id', spareDriverEmployeeId)
      .maybeSingle()

    if (!spareCheck?.spare_driver) {
      return NextResponse.json({ error: 'Selected employee is not marked as a spare driver' }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from('route_spares')
      .insert({
        route_id: routeId,
        spare_type: 'driver',
        driver_employee_id: spareDriverEmployeeId,
        covers_date: sessionDate,
        starts_at,
        ends_at,
        reason:
          reason ??
          `Operations calendar: spare driver for ${sessionDate} (expired document coverage)`,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) throw error

    console.debug(
      '[fleet] routes-calendar/assign-spare-driver',
      row?.id,
      routeId,
      spareDriverEmployeeId,
      sessionDate
    )

    return NextResponse.json({ success: true, id: row?.id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Assign spare failed'
    console.error('[fleet] routes-calendar/assign-spare-driver', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
