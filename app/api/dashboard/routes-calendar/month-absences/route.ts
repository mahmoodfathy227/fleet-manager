import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** GET ?month=YYYY-MM&schoolId=&routeId= — parent absence reports linked to sessions in that month (calendar scope). */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const month = request.nextUrl.searchParams.get('month')
  const schoolIdParam = request.nextUrl.searchParams.get('schoolId')
  const routeIdParam = request.nextUrl.searchParams.get('routeId')

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month (YYYY-MM) required' }, { status: 400 })
  }

  const [y, m] = month.split('-').map(Number)
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd = new Date(y, m, 0)
  const startStr = ymd(monthStart)
  const endStr = ymd(monthEnd)

  try {
    let routeQuery = supabase
      .from('routes')
      .select('id, route_number, school_id, schools(id, name)')
    if (schoolIdParam && schoolIdParam !== 'all') {
      const sid = parseInt(schoolIdParam, 10)
      if (!Number.isNaN(sid)) routeQuery = routeQuery.eq('school_id', sid)
    }
    if (routeIdParam && routeIdParam !== 'all') {
      const rid = parseInt(routeIdParam, 10)
      if (!Number.isNaN(rid)) routeQuery = routeQuery.eq('id', rid)
    }

    const { data: routeRows, error: routeErr } = await routeQuery
    if (routeErr) throw routeErr
    const routes = routeRows ?? []
    const routeIds = routes.map((r: { id: number }) => r.id)
    const routeMap = new Map(routes.map((r: { id: number }) => [r.id, r]))

    if (routeIds.length === 0) {
      console.debug('[fleet] routes-calendar/month-absences: no routes', { month, schoolIdParam, routeIdParam })
      return NextResponse.json({ absences: [] })
    }

    const { data: sessions, error: sessErr } = await supabase
      .from('route_sessions')
      .select('id, route_id, session_date, session_type')
      .gte('session_date', startStr)
      .lte('session_date', endStr)
      .in('route_id', routeIds)

    if (sessErr) throw sessErr
    const sessionList = sessions ?? []
    const sessionIds = sessionList.map((s: { id: number }) => s.id)
    if (sessionIds.length === 0) {
      console.debug('[fleet] routes-calendar/month-absences: no sessions', month)
      return NextResponse.json({ absences: [] })
    }

    const { data: reports, error: repErr } = await supabase
      .from('parent_absence_reports')
      .select('id, passenger_id, route_session_id, reason, status')
      .in('route_session_id', sessionIds)

    if (repErr) throw repErr

    const sessMap = new Map(sessionList.map((s: { id: number }) => [s.id, s]))
    const paxIds = Array.from(new Set((reports ?? []).map((r: { passenger_id: number }) => r.passenger_id)))
    let paxMap = new Map<number, { full_name: string }>()
    if (paxIds.length > 0) {
      const { data: pax, error: paxErr } = await supabase
        .from('passengers')
        .select('id, full_name')
        .in('id', paxIds)
      if (paxErr) throw paxErr
      paxMap = new Map((pax ?? []).map((p: { id: number; full_name: string }) => [p.id, { full_name: p.full_name }]))
    }

    const absences = (reports ?? [])
      .map((r: { id: number; passenger_id: number; route_session_id: number; reason: string | null; status: string | null }) => {
        const sess = sessMap.get(r.route_session_id) as
          | { route_id: number; session_date: string; session_type: string }
          | undefined
        const route = sess ? (routeMap.get(sess.route_id) as { route_number?: string | null; schools?: { name?: string } | null } | undefined) : undefined
        return {
          id: r.id,
          session_date: sess?.session_date?.slice(0, 10) ?? '',
          session_type: sess?.session_type ?? '',
          passenger_id: r.passenger_id,
          child_name: paxMap.get(r.passenger_id)?.full_name ?? null,
          route_id: sess?.route_id ?? 0,
          route_number: route?.route_number ?? null,
          school_name: route?.schools?.name ?? null,
          route_session_id: r.route_session_id,
          reason: r.reason,
          status: r.status,
        }
      })
      .sort((a, b) => {
        const d = b.session_date.localeCompare(a.session_date)
        if (d !== 0) return d
        return (a.child_name || '').localeCompare(b.child_name || '')
      })

    console.debug('[fleet] routes-calendar/month-absences', month, 'rows', absences.length)
    return NextResponse.json({ absences })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load month absences'
    console.error('[fleet] routes-calendar/month-absences', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
