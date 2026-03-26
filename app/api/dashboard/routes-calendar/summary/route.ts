import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { collectStaffExpiryIssuesForSession } from '@/lib/routesCalendar'

export const dynamic = 'force-dynamic'

type DayAgg = { hasData: boolean; hasAlert: boolean }

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** GET ?month=YYYY-MM&schoolId=&routeId= */
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
    let routeQuery = supabase.from('routes').select('id, school_id')
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
    const routeIds = (routeRows ?? []).map((r: { id: number }) => r.id)
    const routeIdSet = new Set(routeIds)

    const byDate: Record<string, DayAgg> = {}
    const touch = (dateStr: string, data: boolean, alert: boolean) => {
      if (!byDate[dateStr]) byDate[dateStr] = { hasData: false, hasAlert: false }
      if (data) byDate[dateStr].hasData = true
      if (alert) byDate[dateStr].hasAlert = true
    }

    if (routeIds.length === 0) {
      console.debug('[fleet] routes-calendar/summary: no routes in scope', { month, schoolIdParam, routeIdParam })
      return NextResponse.json({ summary: [] })
    }

    const { data: sessions, error: sessErr } = await supabase
      .from('route_sessions')
      .select(
        'id, route_id, session_date, session_type, driver_id, passenger_assistant_id'
      )
      .gte('session_date', startStr)
      .lte('session_date', endStr)
      .in('route_id', routeIds)

    if (sessErr) throw sessErr

    const driverIds = new Set<number>()
    const paIds = new Set<number>()
    for (const s of sessions ?? []) {
      const row = s as {
        session_date: string
        route_id: number
        driver_id: number | null
        passenger_assistant_id: number | null
      }
      if (!routeIdSet.has(row.route_id)) continue
      touch(row.session_date.slice(0, 10), true, false)
      if (row.driver_id) driverIds.add(row.driver_id)
      if (row.passenger_assistant_id) paIds.add(row.passenger_assistant_id)
    }

    const driverSelect =
      'employee_id, tas_badge_expiry_date, dbs_expiry_date, first_aid_certificate_expiry_date, passport_expiry_date, driving_license_expiry_date, cpc_expiry_date, employees(full_name)'
    const paSelect =
      'employee_id, tas_badge_expiry_date, dbs_expiry_date, employees(full_name)'

    const [driversRes, pasRes] = await Promise.all([
      driverIds.size
        ? supabase.from('drivers').select(driverSelect).in('employee_id', Array.from(driverIds))
        : Promise.resolve({ data: [] as unknown[], error: null }),
      paIds.size
        ? supabase.from('passenger_assistants').select(paSelect).in('employee_id', Array.from(paIds))
        : Promise.resolve({ data: [] as unknown[], error: null }),
    ])

    if (driversRes.error) throw driversRes.error
    if (pasRes.error) throw pasRes.error

    const driverMap = new Map<number, Record<string, unknown>>()
    for (const d of driversRes.data ?? []) {
      const row = d as { employee_id: number }
      driverMap.set(row.employee_id, row as Record<string, unknown>)
    }
    const paMap = new Map<number, Record<string, unknown>>()
    for (const p of pasRes.data ?? []) {
      const row = p as { employee_id: number }
      paMap.set(row.employee_id, row as Record<string, unknown>)
    }

    for (const s of sessions ?? []) {
      const row = s as {
        session_date: string
        route_id: number
        driver_id: number | null
        passenger_assistant_id: number | null
      }
      if (!routeIdSet.has(row.route_id)) continue
      const dStr = row.session_date.slice(0, 10)
      const dr = row.driver_id ? driverMap.get(row.driver_id) ?? null : null
      const pa = row.passenger_assistant_id ? paMap.get(row.passenger_assistant_id) ?? null : null
      const issues = collectStaffExpiryIssuesForSession(dStr, dr, pa)
      if (issues.some((i) => i.status === 'expired' || i.status === 'expiring_soon')) {
        touch(dStr, false, true)
      }
    }

    const sessionMeta = new Map<number, { dateStr: string; routeId: number }>()
    for (const s of sessions ?? []) {
      const row = s as { id: number; route_id: number; session_date: string }
      sessionMeta.set(row.id, { dateStr: row.session_date.slice(0, 10), routeId: row.route_id })
    }
    const sessionIds = Array.from(sessionMeta.keys())
    if (sessionIds.length > 0) {
      const { data: absences, error: absErr } = await supabase
        .from('parent_absence_reports')
        .select('id, route_session_id')
        .in('route_session_id', sessionIds)

      if (absErr) throw absErr
      for (const a of absences ?? []) {
        const row = a as { route_session_id: number }
        const meta = sessionMeta.get(row.route_session_id)
        if (!meta || !routeIdSet.has(meta.routeId)) continue
        touch(meta.dateStr, true, true)
      }
    }

    const { data: ru, error: ruErr } = await supabase
      .from('route_updates')
      .select('id, route_id, created_at')
      .gte('created_at', `${startStr}T00:00:00`)
      .lte('created_at', `${endStr}T23:59:59`)

    if (ruErr) throw ruErr
    for (const u of ru ?? []) {
      const row = u as { route_id: number; created_at: string }
      if (!routeIdSet.has(row.route_id)) continue
      const dStr = row.created_at.slice(0, 10)
      touch(dStr, true, false)
    }

    const { data: passengers, error: pErr } = await supabase
      .from('passengers')
      .select('id, route_id')
      .in('route_id', routeIds)

    if (pErr) throw pErr
    const paxByRoute = new Map<number, number[]>()
    for (const p of passengers ?? []) {
      const row = p as { id: number; route_id: number | null }
      if (!row.route_id) continue
      if (!paxByRoute.has(row.route_id)) paxByRoute.set(row.route_id, [])
      paxByRoute.get(row.route_id)!.push(row.id)
    }
    const allPaxIds = Array.from(new Set((passengers ?? []).map((p: { id: number }) => p.id)))
    if (allPaxIds.length > 0) {
      const { data: pUpdates, error: puErr } = await supabase
        .from('passenger_updates')
        .select('id, passenger_id, created_at')
        .in('passenger_id', allPaxIds)
        .gte('created_at', `${startStr}T00:00:00`)
        .lte('created_at', `${endStr}T23:59:59`)

      if (puErr) throw puErr
      const paxRoute = new Map<number, number>()
      for (const p of passengers ?? []) {
        const row = p as { id: number; route_id: number | null }
        if (row.route_id) paxRoute.set(row.id, row.route_id)
      }
      for (const u of pUpdates ?? []) {
        const row = u as { passenger_id: number; created_at: string }
        const rid = paxRoute.get(row.passenger_id)
        if (rid == null || !routeIdSet.has(rid)) continue
        const dStr = row.created_at.slice(0, 10)
        touch(dStr, true, false)
      }
    }

    const summary = Object.entries(byDate).map(([date, v]) => ({
      date,
      hasData: v.hasData,
      hasAlert: v.hasAlert,
    }))
    summary.sort((a, b) => a.date.localeCompare(b.date))

    console.debug('[fleet] routes-calendar/summary', month, 'days', summary.length)

    return NextResponse.json({ summary })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Summary failed'
    console.error('[fleet] routes-calendar/summary', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
