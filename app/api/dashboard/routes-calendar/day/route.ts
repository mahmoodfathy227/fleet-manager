import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { collectStaffExpiryIssuesForSession } from '@/lib/routesCalendar'

export const dynamic = 'force-dynamic'

/** Spare row applies to this calendar day (covers_date or legacy time overlap in UTC). */
function spareAppliesOnDate(
  row: {
    covers_date?: string | null
    starts_at?: string | null
    ends_at?: string | null
    is_active?: boolean
  },
  date: string
): boolean {
  if (row.is_active === false) return false
  const cd = row.covers_date != null && row.covers_date !== '' ? String(row.covers_date).slice(0, 10) : null
  if (cd) return cd === date
  const dayStart = Date.parse(`${date}T00:00:00.000Z`)
  const dayEnd = dayStart + 24 * 60 * 60 * 1000
  const s = row.starts_at ? Date.parse(String(row.starts_at)) : 0
  const e = row.ends_at ? Date.parse(String(row.ends_at)) : Number.POSITIVE_INFINITY
  return s < dayEnd && e > dayStart
}

/** GET ?date=YYYY-MM-DD&schoolId=&routeId= */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const date = request.nextUrl.searchParams.get('date')
  const schoolIdParam = request.nextUrl.searchParams.get('schoolId')
  const routeIdParam = request.nextUrl.searchParams.get('routeId')

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 })
  }

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
    const routeIdSet = new Set(routeIds)
    const routeMap = new Map(routes.map((r: { id: number }) => [r.id, r]))

    if (routeIds.length === 0) {
      return NextResponse.json({
        date,
        sessions: [],
        cancellations: [],
        routeUpdates: [],
        passengerUpdates: [],
        spareDrivers: [],
      })
    }

    const driverSelect =
      'employee_id, tas_badge_expiry_date, dbs_expiry_date, first_aid_certificate_expiry_date, passport_expiry_date, driving_license_expiry_date, cpc_expiry_date, employees(full_name)'
    const paSelect = 'id, employee_id, tas_badge_expiry_date, dbs_expiry_date, employees(full_name)'

    const { data: sessions, error: sessErr } = await supabase
      .from('route_sessions')
      .select(
        'id, route_id, session_date, session_type, driver_id, passenger_assistant_id, notes, started_at, ended_at'
      )
      .eq('session_date', date)
      .in('route_id', routeIds)

    if (sessErr) throw sessErr

    const driverIds = new Set<number>()
    const paIds = new Set<number>()
    for (const s of sessions ?? []) {
      const row = s as { driver_id: number | null; passenger_assistant_id: number | null }
      if (row.driver_id) driverIds.add(row.driver_id)
      if (row.passenger_assistant_id) paIds.add(row.passenger_assistant_id)
    }

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

    const sessionIds = (sessions ?? []).map((s: { id: number }) => s.id)
    const spareByRoute = new Map<number, unknown[]>()

    if (sessionIds.length > 0 && routeIds.length > 0) {
      const { data: spares } = await supabase
        .from('route_spares')
        .select(
          'id, route_id, spare_type, driver_employee_id, pa_employee_id, vehicle_id, covers_date, starts_at, ends_at, is_active, reason'
        )
        .in('route_id', routeIds)
        .eq('is_active', true)

      const spareDriverIds = new Set<number>()
      for (const sp of spares ?? []) {
        const row = sp as {
          route_id: number
          driver_employee_id: number | null
          covers_date?: string | null
          starts_at?: string | null
          ends_at?: string | null
          is_active?: boolean
        }
        if (!spareAppliesOnDate(row, date)) continue
        if (!spareByRoute.has(row.route_id)) spareByRoute.set(row.route_id, [])
        spareByRoute.get(row.route_id)!.push(sp)
        if (row.driver_employee_id) spareDriverIds.add(row.driver_employee_id)
      }
      let spareNameMap = new Map<number, string>()
      if (spareDriverIds.size > 0) {
        const { data: dn } = await supabase
          .from('drivers')
          .select('employee_id, employees(full_name)')
          .in('employee_id', Array.from(spareDriverIds))
        for (const d of dn ?? []) {
          const row = d as { employee_id: number; employees?: { full_name?: string } }
          spareNameMap.set(row.employee_id, row.employees?.full_name ?? `Driver #${row.employee_id}`)
        }
      }
      for (const [, list] of Array.from(spareByRoute.entries())) {
        for (const sp of list) {
          const row = sp as { driver_employee_id?: number | null; spare_driver_name?: string }
          if (row.driver_employee_id && spareNameMap.has(row.driver_employee_id)) {
            row.spare_driver_name = spareNameMap.get(row.driver_employee_id)
          }
        }
      }
    }

    const spareDriverPool = await supabase
      .from('drivers')
      .select('employee_id, spare_driver, employees(id, full_name, can_work, employment_status)')
      .eq('spare_driver', true)
      .order('employee_id', { ascending: true })

    if (spareDriverPool.error) {
      console.error('[fleet] routes-calendar/day: spare drivers query failed', spareDriverPool.error)
    }

    // Do not default missing can_work to false — that removed every row when employees() embed was empty
    // or when coordinators still need to pick a marked spare for cover. Only hide explicit not-work flags if desired.
    let spareDriversList = (spareDriverPool.data ?? []).map((row: Record<string, unknown>) => {
      const emp = row.employees as
        | { full_name?: string; can_work?: boolean | null; employment_status?: string | null }
        | null
        | undefined
      const eid = row.employee_id as number
      return {
        employee_id: eid,
        full_name: emp?.full_name ?? `Driver #${eid}`,
        can_work: emp?.can_work ?? null,
        employment_status: emp?.employment_status ?? null,
      }
    })

    // Fallback: no rows (embed failed or zero spare_driver in DB) — same columns as /dashboard/spares/drivers
    if (spareDriversList.length === 0) {
      const { data: fallbackRows, error: fbErr } = await supabase
        .from('drivers')
        .select('employee_id, employees(full_name, employment_status)')
        .eq('spare_driver', true)

      if (fbErr) {
        console.error('[fleet] routes-calendar/day: spare drivers fallback query failed', fbErr)
      } else {
        spareDriversList = (fallbackRows ?? []).map((row: Record<string, unknown>) => {
          const emp = row.employees as { full_name?: string; employment_status?: string | null } | null | undefined
          const eid = row.employee_id as number
          return {
            employee_id: eid,
            full_name: emp?.full_name ?? `Driver #${eid}`,
            can_work: null as boolean | null,
            employment_status: emp?.employment_status ?? null,
          }
        })
        console.debug('[fleet] routes-calendar/day: using fallback spare list', spareDriversList.length)
      }
    }

    console.debug('[fleet] routes-calendar/day: spareDrivers count', spareDriversList.length)

    const sessionsOut = (sessions ?? []).map((s: Record<string, unknown>) => {
      const routeId = s.route_id as number
      const dr = s.driver_id ? driverMap.get(s.driver_id as number) ?? null : null
      const pa = s.passenger_assistant_id ? paMap.get(s.passenger_assistant_id as number) ?? null : null
      const staffIssues = collectStaffExpiryIssuesForSession(date, dr, pa)
      const route = routeMap.get(routeId) as
        | { id: number; route_number: string | null; school_id: number | null; schools: { name?: string } | null }
        | undefined
      return {
        id: s.id,
        route_id: routeId,
        route_number: route?.route_number ?? null,
        school_name: route?.schools?.name ?? null,
        session_type: s.session_type,
        driver_id: s.driver_id,
        driver_name: dr ? (dr.employees as { full_name?: string })?.full_name ?? null : null,
        passenger_assistant_id: s.passenger_assistant_id,
        passenger_assistant_row_id: pa ? (pa.id as number) ?? null : null,
        pa_name: pa ? (pa.employees as { full_name?: string })?.full_name ?? null : null,
        notes: s.notes,
        started_at: s.started_at,
        ended_at: s.ended_at,
        staff_expiry_issues: staffIssues,
        route_spares: spareByRoute.get(routeId) ?? [],
      }
    })

    let cancellations: Array<{
      id: number
      passenger_id: number
      child_name: string | null
      route_session_id: number
      route_id: number | null
      reason: string | null
      status: string | null
    }> = []

    if (sessionIds.length > 0) {
      const { data: abs, error: absErr } = await supabase
        .from('parent_absence_reports')
        .select('id, passenger_id, route_session_id, reason, status')
        .in('route_session_id', sessionIds)

      if (absErr) throw absErr
      const paxIds = Array.from(new Set((abs ?? []).map((a: { passenger_id: number }) => a.passenger_id)))
      let paxMap = new Map<number, { full_name: string }>()
      if (paxIds.length > 0) {
        const { data: pax } = await supabase.from('passengers').select('id, full_name').in('id', paxIds)
        paxMap = new Map((pax ?? []).map((p: { id: number; full_name: string }) => [p.id, { full_name: p.full_name }]))
      }
      const sessRoute = new Map(
        (sessions ?? []).map((s: { id: number; route_id: number }) => [s.id, s.route_id])
      )
      cancellations = (abs ?? []).map((a: any) => ({
        id: a.id,
        passenger_id: a.passenger_id,
        child_name: paxMap.get(a.passenger_id)?.full_name ?? null,
        route_session_id: a.route_session_id,
        route_id: sessRoute.get(a.route_session_id) ?? null,
        reason: a.reason,
        status: a.status,
      }))
    }

    const { data: ru } = await supabase
      .from('route_updates')
      .select('id, route_id, update_text, created_at')
      .in('route_id', routeIds)
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)

    const routeUpdates = (ru ?? []).filter((u: { route_id: number }) => routeIdSet.has(u.route_id))

    const { data: passengers } = await supabase.from('passengers').select('id, full_name, route_id').in('route_id', routeIds)
    const paxIdsOnRoutes = (passengers ?? []).map((p: { id: number }) => p.id)
    let passengerUpdates: Array<{
      id: number
      passenger_id: number
      child_name: string | null
      route_id: number | null
      update_text: string
      created_at: string
    }> = []

    if (paxIdsOnRoutes.length > 0) {
      const { data: pu } = await supabase
        .from('passenger_updates')
        .select('id, passenger_id, update_text, created_at')
        .in('passenger_id', paxIdsOnRoutes)
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)

      const paxRoute = new Map(
        (passengers ?? []).map((p: { id: number; route_id: number | null }) => [p.id, p])
      )
      passengerUpdates = (pu ?? []).map((u: any) => {
        const p = paxRoute.get(u.passenger_id) as { full_name?: string; route_id?: number | null } | undefined
        return {
          id: u.id,
          passenger_id: u.passenger_id,
          child_name: p?.full_name ?? null,
          route_id: p?.route_id ?? null,
          update_text: u.update_text,
          created_at: u.created_at,
        }
      })
    }

    console.debug('[fleet] routes-calendar/day', date, 'sessions', sessionsOut.length)

    return NextResponse.json({
      date,
      sessions: sessionsOut,
      cancellations,
      routeUpdates,
      passengerUpdates,
      spareDrivers: spareDriversList,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Day load failed'
    console.error('[fleet] routes-calendar/day', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
