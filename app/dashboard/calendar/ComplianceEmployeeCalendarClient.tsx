'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDate } from '@/lib/utils'
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
import { ChevronLeft, ChevronRight, X, User } from 'lucide-react'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type DaySummary = { date: string; total_docs: number; has_issue: boolean }

type DayCert = {
  source: string
  entity_type: string
  entity_id: number
  profile_url: string
  entity_name: string
  doc_type: string
  expiry_date: string
  days_remaining: number | null
  status: string
}

export function ComplianceEmployeeCalendarClient() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [summary, setSummary] = useState<DaySummary[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayCerts, setDayCerts] = useState<DayCert[]>([])
  const [loadingDay, setLoadingDay] = useState(false)
  const [dayHasIssue, setDayHasIssue] = useState(false)

  const monthParam = `${year}-${String(month).padStart(2, '0')}`

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch(`/api/compliance/employees/calendar/summary?month=${monthParam}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load summary')
      setSummary(data.summary || [])
    } catch {
      setSummary([])
    } finally {
      setLoadingSummary(false)
    }
  }, [monthParam])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const summaryByDate = summary.reduce<Record<string, DaySummary>>((acc, s) => {
    acc[s.date] = s
    return acc
  }, {})

  const onDayClick = useCallback(async (dateStr: string) => {
    setSelectedDate(dateStr)
    const daySummary = summary.find((s) => s.date === dateStr)
    const issuesOnly = !!(daySummary?.has_issue)
    setDayHasIssue(issuesOnly)
    setLoadingDay(true)
    setDayCerts([])
    try {
      const res = await fetch(
        `/api/compliance/employees/calendar/day?date=${dateStr}&issuesOnly=${issuesOnly}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load day')
      setDayCerts(data.documents || [])
    } catch {
      setDayCerts([])
    } finally {
      setLoadingDay(false)
    }
  }, [summary])

  const monthStart = startOfMonth(new Date(year, month - 1))
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const selectedDateLabel = selectedDate
    ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy')
    : ''

  return (
    <>
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
                const showDot = !!(s && s.total_docs > 0)
                const isRed = !!(s?.has_issue)
                const isCurrentMonth = isSameMonth(day, monthStart)
                const isSelected = selectedDate && isSameDay(parseISO(selectedDate), day)

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => onDayClick(dateStr)}
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
                        aria-label={isRed ? 'Has expiring certificate' : 'Has certificates'}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {selectedDate && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">
              {dayHasIssue ? 'Expiring / expired certificates' : 'Certificates'} — {selectedDateLabel}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loadingDay && (
              <div className="py-8 text-center text-slate-500 text-sm">Loading…</div>
            )}
            {!loadingDay && dayCerts.length === 0 && (
              <div className="py-8 text-center text-slate-500 text-sm">
                {dayHasIssue
                  ? 'No expiring certificates on this day.'
                  : 'No certificates expiring on this day.'}
              </div>
            )}
            {!loadingDay && dayCerts.length > 0 && (
              <div className="space-y-4">
                {dayCerts.map((cert, i) => (
                  <EmployeeCertCard key={`${cert.entity_type}-${cert.entity_id}-${cert.doc_type}-${i}`} cert={cert} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}

function EmployeeCertCard({ cert }: { cert: DayCert }) {
  const statusBadge =
    cert.status === 'expired'
      ? 'bg-red-100 text-red-800 border-red-200'
      : cert.status === 'expiring_soon'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-green-100 text-green-800 border-green-200'
  const statusLabel = cert.status === 'expired' ? 'Expired' : cert.status === 'expiring_soon' ? 'Expiring soon' : 'OK'

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-2 bg-white">
      <div className="flex flex-wrap items-center gap-2">
        <User className="h-4 w-4 text-slate-500" />
        <Link
          href={cert.profile_url}
          className="font-medium text-slate-900 text-primary hover:underline"
        >
          {cert.entity_name}
        </Link>
        <span className="text-xs text-slate-500">({cert.entity_type === 'driver' ? 'Driver' : 'PA'})</span>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge}`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="text-slate-500">Certificate:</span>{' '}
          <span className="font-medium">{cert.doc_type}</span>
        </div>
        <div>
          <span className="text-slate-500">Expiry:</span> <span>{cert.expiry_date ? formatDate(cert.expiry_date) : '—'}</span>
        </div>
        <div>
          <span className="text-slate-500">Days remaining:</span>{' '}
          <span>
            {cert.days_remaining !== null
              ? cert.days_remaining < 0
                ? `${Math.abs(cert.days_remaining)} days overdue`
                : `${cert.days_remaining} days`
              : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
