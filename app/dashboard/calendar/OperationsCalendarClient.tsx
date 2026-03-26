'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { formatDate } from '@/lib/utils'
import { emitComplianceNotificationsChanged } from '@/lib/complianceNotificationsEvents'
import {
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Bus,
  Mail,
  UserPlus,
  ClipboardList,
} from 'lucide-react'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type School = { id: number; name: string }
type RouteRow = {
  id: number
  route_number: string | null
  school_id: number | null
  schools: { id: number; name: string } | null
}

type DaySummary = { date: string; hasData: boolean; hasAlert: boolean }

type StaffIssue = {
  role: 'driver' | 'pa'
  employeeId: number
  fullName: string
  certLabel: string
  certKey: string
  expiryDate: string | null
  status: string
}

type SessionDetail = {
  id: number
  route_id: number
  route_number: string | null
  school_name: string | null
  session_type: string
  driver_id: number | null
  driver_name: string | null
  passenger_assistant_id: number | null
  passenger_assistant_row_id: number | null
  pa_name: string | null
  notes: string | null
  started_at: string | null
  ended_at: string | null
  staff_expiry_issues: StaffIssue[]
  route_spares: Array<Record<string, unknown>>
}

type MonthAbsenceRow = {
  id: number
  session_date: string
  session_type: string
  passenger_id: number
  child_name: string | null
  route_id: number
  route_number: string | null
  school_name: string | null
  route_session_id: number
  reason: string | null
  status: string | null
}

export function OperationsCalendarClient() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [schoolId, setSchoolId] = useState<string>('all')
  const [routeId, setRouteId] = useState<string>('all')

  const [schools, setSchools] = useState<School[]>([])
  const [allRoutes, setAllRoutes] = useState<RouteRow[]>([])
  const [summary, setSummary] = useState<DaySummary[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [metaError, setMetaError] = useState<string | null>(null)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayLoading, setDayLoading] = useState(false)
  const [dayError, setDayError] = useState<string | null>(null)
  const [dayData, setDayData] = useState<{
    sessions: SessionDetail[]
    cancellations: Array<{
      id: number
      child_name: string | null
      route_id: number | null
      reason: string | null
      status: string | null
    }>
    routeUpdates: Array<{ id: number; route_id: number; update_text: string; created_at: string }>
    passengerUpdates: Array<{
      id: number
      child_name: string | null
      route_id: number | null
      update_text: string
      created_at: string
    }>
    spareDrivers: Array<{
      employee_id: number
      full_name: string
      can_work: boolean | null
      employment_status: string | null
    }>
  } | null>(null)

  const [warningBusy, setWarningBusy] = useState<string | null>(null)
  const [spareBusy, setSpareBusy] = useState<string | null>(null)
  const [spareChoice, setSpareChoice] = useState<Record<number, string>>({})

  const [monthAbsences, setMonthAbsences] = useState<MonthAbsenceRow[]>([])
  const [monthAbsencesLoading, setMonthAbsencesLoading] = useState(false)
  const [monthAbsencesError, setMonthAbsencesError] = useState<string | null>(null)

  const monthParam = `${year}-${String(month).padStart(2, '0')}`

  useEffect(() => {
    console.debug(
      '[fleet] OperationsCalendarClient mounted (routes / schools / compliance; demo absence seed removed)'
    )
  }, [])

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true)
    setMetaError(null)
    try {
      const res = await fetch('/api/dashboard/routes-calendar/meta')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load filters')
      setSchools(data.schools || [])
      setAllRoutes(data.routes || [])
    } catch (e: unknown) {
      setMetaError(e instanceof Error ? e.message : 'Failed to load schools/routes')
      setSchools([])
      setAllRoutes([])
    } finally {
      setLoadingMeta(false)
    }
  }, [])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  const routesInSchool = useMemo(() => {
    if (schoolId === 'all') return allRoutes
    const sid = parseInt(schoolId, 10)
    if (Number.isNaN(sid)) return allRoutes
    return allRoutes.filter((r) => r.school_id === sid)
  }, [allRoutes, schoolId])

  useEffect(() => {
    if (routeId !== 'all') {
      const r = allRoutes.find((x) => String(x.id) === routeId)
      if (r && schoolId !== 'all' && String(r.school_id) !== schoolId) {
        setRouteId('all')
      }
    }
  }, [schoolId, routeId, allRoutes])

  const filterQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (schoolId !== 'all') p.set('schoolId', schoolId)
    if (routeId !== 'all') p.set('routeId', routeId)
    const q = p.toString()
    return q ? `&${q}` : ''
  }, [schoolId, routeId])

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch(`/api/dashboard/routes-calendar/summary?month=${monthParam}${filterQuery}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load summary')
      setSummary(data.summary || [])
    } catch {
      setSummary([])
    } finally {
      setLoadingSummary(false)
    }
  }, [monthParam, filterQuery])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const loadMonthAbsences = useCallback(async () => {
    setMonthAbsencesLoading(true)
    setMonthAbsencesError(null)
    try {
      const q = new URLSearchParams()
      q.set('month', monthParam)
      if (schoolId !== 'all') q.set('schoolId', schoolId)
      if (routeId !== 'all') q.set('routeId', routeId)
      const res = await fetch(`/api/dashboard/routes-calendar/month-absences?${q}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load month absences')
      setMonthAbsences(data.absences || [])
      console.debug('[fleet] operations-calendar month absences loaded', (data.absences || []).length)
    } catch (e: unknown) {
      setMonthAbsences([])
      setMonthAbsencesError(e instanceof Error ? e.message : 'Failed to load absences')
    } finally {
      setMonthAbsencesLoading(false)
    }
  }, [monthParam, schoolId, routeId])

  useEffect(() => {
    loadMonthAbsences()
  }, [loadMonthAbsences])

  const summaryByDate = useMemo(() => {
    const m: Record<string, DaySummary> = {}
    for (const s of summary) m[s.date] = s
    return m
  }, [summary])

  const loadDay = useCallback(
    async (dateStr: string) => {
      setSelectedDate(dateStr)
      setDayLoading(true)
      setDayError(null)
      setDayData(null)
      try {
        const res = await fetch(`/api/dashboard/routes-calendar/day?date=${dateStr}${filterQuery}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load day')
        setDayData({
          sessions: data.sessions || [],
          cancellations: data.cancellations || [],
          routeUpdates: data.routeUpdates || [],
          passengerUpdates: data.passengerUpdates || [],
          spareDrivers: data.spareDrivers || [],
        })
      } catch (e: unknown) {
        setDayError(e instanceof Error ? e.message : 'Failed to load day')
      } finally {
        setDayLoading(false)
      }
    },
    [filterQuery]
  )

  const monthStart = startOfMonth(new Date(year, month - 1))
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const selectedDateLabel = selectedDate
    ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy')
    : ''

  const sendWarning = async (issue: StaffIssue) => {
    const key = `${issue.role}-${issue.employeeId}-${issue.certKey}`
    setWarningBusy(key)
    try {
      const res = await fetch('/api/dashboard/routes-calendar/warning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: issue.employeeId,
          certKey: issue.certKey,
          certLabel: issue.certLabel,
          expiryDate: issue.expiryDate || selectedDate,
          role: issue.role,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create notification')
      emitComplianceNotificationsChanged('operations-calendar-sendWarning')
      alert(`Warning notification created (#${data.notificationId}). Review under Compliance or Notifications.`)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to send warning')
    } finally {
      setWarningBusy(null)
    }
  }

  const assignSpare = async (routeIdNum: number) => {
    const sid = spareChoice[routeIdNum]
    if (!sid) {
      alert('Select a spare driver first')
      return
    }
    if (!selectedDate) {
      alert('No day selected')
      return
    }
    const bkey = `spare-${routeIdNum}`
    setSpareBusy(bkey)
    try {
      const res = await fetch('/api/dashboard/routes-calendar/assign-spare-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: routeIdNum,
          spareDriverEmployeeId: parseInt(sid, 10),
          sessionDate: selectedDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Assignment failed')
      alert(`Spare driver assigned for ${selectedDate} only.`)
      if (selectedDate) await loadDay(selectedDate)
      await loadSummary()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Assignment failed')
    } finally {
      setSpareBusy(null)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 flex-1 max-w-4xl">
          <div>
            <Label htmlFor="cal-school">School</Label>
            <Select
              id="cal-school"
              selectSize="sm"
              className="mt-1 w-full"
              value={schoolId}
              disabled={loadingMeta}
              onChange={(e) => {
                setSchoolId(e.target.value)
                setRouteId('all')
              }}
            >
              <option value="all">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="cal-route">Route</Label>
            <Select
              id="cal-route"
              selectSize="sm"
              className="mt-1 w-full"
              value={routeId}
              disabled={loadingMeta}
              onChange={(e) => setRouteId(e.target.value)}
            >
              <option value="all">All routes {schoolId !== 'all' ? '(in school)' : ''}</option>
              {routesInSchool.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.route_number || `Route #${r.id}`}
                  {r.schools?.name ? ` — ${r.schools.name}` : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {metaError && <p className="text-sm text-red-600">{metaError}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-row items-center justify-between gap-4 h-14 px-6 bg-slate-50 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-700 tracking-tight">
            {format(monthStart, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const d = subMonths(new Date(year, month - 1), 1)
                setYear(d.getFullYear())
                setMonth(d.getMonth() + 1)
              }}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date()
                setYear(now.getFullYear())
                setMonth(now.getMonth() + 1)
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const d = addMonths(new Date(year, month - 1), 1)
                setYear(d.getFullYear())
                setMonth(d.getMonth() + 1)
              }}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4">
          {loadingSummary && (
            <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
              Loading calendar…
            </div>
          )}
          {!loadingSummary && (
            <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-xl overflow-hidden">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="h-11 px-2 flex items-center justify-center bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const s = summaryByDate[dateStr]
                const showDot = !!(s?.hasData || s?.hasAlert)
                const isRed = !!s?.hasAlert
                const isCurrentMonth = isSameMonth(day, monthStart)
                const isSelected = selectedDate && isSameDay(parseISO(selectedDate), day)

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => loadDay(dateStr)}
                    className={`
                      min-h-[72px] p-2 text-left bg-white hover:bg-slate-50 transition-colors flex flex-col items-start
                      ${!isCurrentMonth ? 'text-slate-400' : 'text-slate-900'}
                      ${isSelected ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''}
                    `}
                  >
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                        isToday(day) ? 'bg-primary text-white' : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {showDot && (
                      <span
                        className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                          isRed ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        aria-label={isRed ? 'Alert: expiry or parent cancellation' : 'Has route activity'}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500 flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Activity (routes, updates)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Alert (expiring/expired crew doc or parent
              cancellation)
            </span>
          </p>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader className="space-y-0 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Passenger absence report — {format(monthStart, 'MMMM yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthAbsencesLoading && (
            <p className="text-sm text-slate-500 py-4">Loading absence list…</p>
          )}
          {monthAbsencesError && <p className="text-sm text-red-600 py-2">{monthAbsencesError}</p>}
          {!monthAbsencesLoading && !monthAbsencesError && monthAbsences.length === 0 && (
            <p className="text-sm text-slate-500 py-2">
              No parent-reported passenger absences in this month for the current school/route filters.
            </p>
          )}
          {!monthAbsencesLoading && monthAbsences.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Session</th>
                    <th className="px-3 py-2">Child</th>
                    <th className="px-3 py-2">Route</th>
                    <th className="px-3 py-2">School</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthAbsences.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-800">
                        {row.session_date ? formatDate(row.session_date) : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.session_type || '—'}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {row.child_name || `Passenger #${row.passenger_id}`}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.route_number || `Route #${row.route_id}`}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.school_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[220px]">{row.reason || '—'}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs uppercase">{row.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDate && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bus className="h-5 w-5 text-primary" />
              {selectedDateLabel}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {dayLoading && <div className="py-8 text-center text-slate-500 text-sm">Loading day…</div>}
            {dayError && <div className="text-sm text-red-600">{dayError}</div>}
            {!dayLoading && dayData && (
              <>
                {dayData.cancellations.length > 0 && (
                  <section>
                    <h3 className="text-sm font-bold text-rose-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Passenger absence reports (this day)
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {dayData.cancellations.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-rose-900"
                        >
                          <span className="font-semibold">{c.child_name || `Passenger #${c.id}`}</span>
                          {c.route_id != null && (
                            <span className="text-rose-700"> — route #{c.route_id}</span>
                          )}
                          {c.reason && <p className="text-xs mt-1 text-rose-800">{c.reason}</p>}
                          {c.status && (
                            <span className="text-[10px] uppercase text-rose-600">({c.status})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2">Route sessions</h3>
                  {dayData.sessions.length === 0 ? (
                    <p className="text-sm text-slate-500">No route sessions on this day (with current filters).</p>
                  ) : (
                    <div className="space-y-4">
                      {dayData.sessions.map((sess) => (
                        <div
                          key={sess.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <span className="font-semibold text-slate-900">
                                {sess.route_number || `Route #${sess.route_id}`}
                              </span>
                              <span className="text-slate-500 text-sm ml-2">
                                {sess.school_name || '—'} · {sess.session_type}
                              </span>
                            </div>
                            <Link
                              href={`/dashboard/routes/${sess.route_id}`}
                              className="text-xs text-primary hover:underline"
                            >
                              Open route
                            </Link>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-slate-500">Driver:</span>{' '}
                              <span className="font-medium">
                                {sess.driver_name || '—'}
                                {sess.driver_id != null && (
                                  <Link
                                    href={`/dashboard/drivers/${sess.driver_id}`}
                                    className="ml-1 text-primary text-xs hover:underline"
                                  >
                                    profile
                                  </Link>
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">PA:</span>{' '}
                              <span className="font-medium">
                                {sess.pa_name || '—'}
                                {sess.passenger_assistant_row_id != null && (
                                  <Link
                                    href={`/dashboard/assistants/${sess.passenger_assistant_row_id}`}
                                    className="ml-1 text-primary text-xs hover:underline"
                                  >
                                    profile
                                  </Link>
                                )}
                              </span>
                            </div>
                          </div>

                          {sess.route_spares.length > 0 && (
                            <div className="text-xs text-slate-600">
                              <span className="font-semibold text-slate-700">Assigned spares (this day):</span>{' '}
                              {sess.route_spares.map((sp, i) => {
                                const r = sp as {
                                  spare_type?: string
                                  spare_driver_name?: string
                                  driver_employee_id?: number
                                  covers_date?: string | null
                                }
                                return (
                                  <span key={i}>
                                    {i > 0 ? '; ' : ''}
                                    {r.spare_type}{' '}
                                    {r.spare_driver_name || r.driver_employee_id || '—'}
                                    {r.covers_date ? (
                                      <span className="text-emerald-700 font-medium"> (dated)</span>
                                    ) : null}
                                  </span>
                                )
                              })}
                            </div>
                          )}

                          {sess.staff_expiry_issues.length > 0 && (
                            <div className="space-y-2 border-t border-slate-200 pt-3">
                              <p className="text-xs font-bold text-slate-700 uppercase">Expiry (session day)</p>
                              {sess.staff_expiry_issues.map((iss, idx) => (
                                <div
                                  key={idx}
                                  className={`rounded-lg border p-3 text-sm ${
                                    iss.status === 'expired'
                                      ? 'border-red-200 bg-red-50'
                                      : iss.status === 'missing'
                                        ? 'border-amber-200 bg-amber-50'
                                        : 'border-orange-200 bg-orange-50'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <span className="font-medium">{iss.fullName}</span>
                                      <span className="text-slate-500 text-xs ml-1">
                                        ({iss.role === 'driver' ? 'Driver' : 'PA'})
                                      </span>
                                      <div className="text-xs mt-0.5">
                                        {iss.certLabel}:{' '}
                                        {iss.expiryDate ? formatDate(iss.expiryDate) : 'Not set'} —{' '}
                                        <span className="font-semibold uppercase">{iss.status.replace('_', ' ')}</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {(iss.status === 'expiring_soon' ||
                                        iss.status === 'missing' ||
                                        iss.status === 'expired') && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 text-xs"
                                          disabled={
                                            warningBusy === `${iss.role}-${iss.employeeId}-${iss.certKey}`
                                          }
                                          onClick={() => sendWarning(iss)}
                                        >
                                          <Mail className="h-3 w-3 mr-1" />
                                          Send warning / notification
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {iss.status === 'expired' && iss.role === 'driver' && (
                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                      <p className="text-[11px] text-slate-600 w-full sm:w-auto sm:mr-2">
                                        Spare applies only on{' '}
                                        <span className="font-semibold text-slate-800">{selectedDateLabel}</span>.
                                      </p>
                                      <Select
                                        selectSize="sm"
                                        className="min-w-[200px]"
                                        value={spareChoice[sess.route_id] ?? ''}
                                        onChange={(e) =>
                                          setSpareChoice((prev) => ({
                                            ...prev,
                                            [sess.route_id]: e.target.value,
                                          }))
                                        }
                                      >
                                        <option value="">Spare driver…</option>
                                        {dayData.spareDrivers.map((d) => (
                                          <option
                                            key={d.employee_id}
                                            value={String(d.employee_id)}
                                            disabled={d.employee_id === sess.driver_id}
                                          >
                                            {d.full_name}
                                            {d.employment_status ? ` (${d.employment_status})` : ''}
                                            {d.can_work === false ? ' — cannot work' : ''}
                                          </option>
                                        ))}
                                      </Select>
                                      {dayData.spareDrivers.length === 0 && (
                                        <p className="text-xs text-amber-800 max-w-md">
                                          No spare drivers returned. Mark drivers as spare in{' '}
                                          <Link href="/dashboard/drivers" className="underline font-medium">
                                            Drivers
                                          </Link>{' '}
                                          (&quot;Mark as Spare Driver&quot;) or see{' '}
                                          <Link href="/dashboard/spares/drivers" className="underline font-medium">
                                            Spare drivers
                                          </Link>
                                          .
                                        </p>
                                      )}
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8"
                                        disabled={spareBusy === `spare-${sess.route_id}`}
                                        onClick={() => assignSpare(sess.route_id)}
                                      >
                                        <UserPlus className="h-3 w-3 mr-1" />
                                        Assign spare
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {sess.notes && (
                            <p className="text-xs text-slate-600">
                              <span className="font-semibold">Session notes:</span> {sess.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {dayData.routeUpdates.length > 0 && (
                  <section>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2">
                      Route updates
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {dayData.routeUpdates.map((u) => (
                        <li key={u.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                          <span className="text-xs text-slate-500">Route #{u.route_id}</span>
                          <p className="text-slate-800 mt-1">{u.update_text}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {dayData.passengerUpdates.length > 0 && (
                  <section>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-2">
                      Parent / passenger updates
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {dayData.passengerUpdates.map((u) => (
                        <li key={u.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                          <span className="font-semibold">{u.child_name || 'Passenger'}</span>
                          {u.route_id != null && (
                            <span className="text-slate-500 text-xs ml-2">Route #{u.route_id}</span>
                          )}
                          <p className="text-slate-700 mt-1">{u.update_text}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
