'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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
import { ChevronLeft, ChevronRight, X, Phone, Mail, Copy, FileText, Car, User } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type DaySummary = { date: string; total_docs: number; has_issue: boolean }

type DayDocument = {
  source?: 'document' | 'subject_document' | 'vehicle_certificate'
  document_id: number | null
  subject_document_id?: string | null
  file_name: string | null
  file_path: string | null
  doc_type: string | null
  created_at: string | null
  expiry_date: string | null
  status: string
  days_remaining: number | null
  vehicle_id: number
  vehicle_name: string
  vehicle_label: string
  make: string | null
  model: string | null
  assigned_driver_id: number | null
  assigned_driver_name: string | null
  contact_email: string | null
  contact_phone: string | null
}

export function ComplianceVehicleCalendarClient() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [summary, setSummary] = useState<DaySummary[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayDocs, setDayDocs] = useState<DayDocument[]>([])
  const [loadingDay, setLoadingDay] = useState(false)
  const [dayHasIssue, setDayHasIssue] = useState(false)
  const { has, loading: permLoading } = usePermissions()
  const canAssignSpare = has('routes.spares.set') || has('vehicle_compliance.write')

  const monthParam = `${year}-${String(month).padStart(2, '0')}`

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch(`/api/compliance/vehicles/calendar/summary?month=${monthParam}`)
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
    setDayDocs([])
    try {
      const res = await fetch(
        `/api/compliance/vehicles/calendar/day?date=${dateStr}&issuesOnly=${issuesOnly}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load day')
      setDayDocs(data.documents || [])
    } catch {
      setDayDocs([])
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
                        aria-label={isRed ? 'Has expiring document' : 'Has documents'}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Day details panel */}
      {selectedDate && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-slate-50/50">
            <CardTitle className="text-base font-semibold text-slate-700">
              {selectedDateLabel}
              {dayHasIssue && (
                <span className="ml-2 text-xs font-normal text-amber-700">(expiring / expired only)</span>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            {loadingDay && (
              <div className="py-8 text-center text-slate-500 text-sm">Loading documents…</div>
            )}
            {!loadingDay && dayDocs.length === 0 && (
              <div className="py-8 text-center text-slate-500 text-sm">
                {dayHasIssue
                  ? 'No expiring documents on this day.'
                  : 'No documents recorded on this day.'}
              </div>
            )}
            {!loadingDay && dayDocs.length > 0 && (
              <div className="space-y-4">
                {dayDocs.map((doc, i) => (
                  <DayDocumentCard
                    key={doc.document_id ?? doc.subject_document_id ?? `v-${doc.vehicle_id}-${doc.doc_type}-${doc.expiry_date}-${i}`}
                    doc={doc}
                    canAssignSpare={canAssignSpare && !permLoading}
                    onSpareAssigned={() => loadSummary()}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}

function DayDocumentCard({
  doc,
  canAssignSpare,
  onSpareAssigned,
}: {
  doc: DayDocument
  canAssignSpare: boolean
  onSpareAssigned: () => void
}) {
  const [assigning, setAssigning] = useState(false)
  const [showSpareModal, setShowSpareModal] = useState(false)
  const [spareVehicles, setSpareVehicles] = useState<{ id: number; label: string }[]>([])
  const [selectedSpareId, setSelectedSpareId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const statusBadge =
    doc.status === 'expired'
      ? 'bg-red-100 text-red-800 border-red-200'
      : doc.status === 'expiring_soon'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-green-100 text-green-800 border-green-200'
  const statusLabel = doc.status === 'expired' ? 'Expired' : doc.status === 'expiring_soon' ? 'Expiring soon' : 'OK'

  const viewUrl = doc.file_path
    ? `/api/documents/view?bucket=VEHICLE_DOCUMENTS&path=${encodeURIComponent(doc.file_path)}`
    : null

  const templateMessage = `Hi ${doc.assigned_driver_name ?? 'there'}, your ${doc.doc_type ?? 'document'} for vehicle ${doc.vehicle_label} expires on ${doc.expiry_date ?? 'N/A'}. Please renew and upload/update the document.`

  const copyTemplate = () => {
    navigator.clipboard.writeText(templateMessage)
  }

  const loadSpareVehicles = async () => {
    const supabase = createClient()
    const { data: list } = await supabase
      .from('vehicles')
      .select('id, registration, vehicle_identifier')
      .eq('spare_vehicle', true)
      .order('registration')
    const arr = Array.isArray(list) ? list : []
    setSpareVehicles(
      arr
        .filter((v: any) => v.id !== doc.vehicle_id)
        .map((v: any) => ({
          id: v.id,
          label: v.registration || v.vehicle_identifier || `Vehicle ${v.id}`,
        }))
    )
  }

  const openSpareModal = () => {
    setShowSpareModal(true)
    setSelectedSpareId(null)
    setReason('')
    loadSpareVehicles()
  }

  const submitAssignSpare = async () => {
    if (!selectedSpareId) return
    setAssigning(true)
    try {
      const res = await fetch('/api/compliance/vehicles/calendar/assign-spare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: doc.vehicle_id,
          spare_vehicle_id: selectedSpareId,
          document_id: doc.document_id ?? undefined,
          reason: reason || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign spare')
      setShowSpareModal(false)
      onSpareAssigned()
    } catch (e: any) {
      alert(e.message || 'Failed to assign spare')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
      <div className="flex flex-wrap items-center gap-2">
        <Car className="h-4 w-4 text-slate-500" />
        <Link
          href={`/dashboard/vehicles/${doc.vehicle_id}`}
          className="font-medium text-slate-900 text-primary hover:underline"
        >
          {doc.vehicle_name}
        </Link>
        {(doc.make || doc.model) && (
          <span className="text-sm text-slate-500">
            {[doc.make, doc.model].filter(Boolean).join(' ')}
          </span>
        )}
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge}`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="text-slate-500">Document type:</span>{' '}
          <span className="font-medium">{doc.doc_type ?? '—'}</span>
        </div>
        <div>
          <span className="text-slate-500">Created:</span>{' '}
          <span>{doc.created_at ? format(parseISO(doc.created_at), 'd MMM yyyy') : '—'}</span>
        </div>
        {doc.source && (
          <div>
            <span className="text-slate-500">Source:</span>{' '}
            <span className="text-xs">
              {doc.source === 'document' ? 'Uploaded document' : doc.source === 'subject_document' ? 'Requirement' : 'Vehicle certificate'}
            </span>
          </div>
        )}
        <div>
          <span className="text-slate-500">Expiry:</span>{' '}
          <span>{doc.expiry_date ?? '—'}</span>
        </div>
        <div>
          <span className="text-slate-500">Days remaining:</span>{' '}
          <span>
            {doc.days_remaining !== null
              ? doc.days_remaining < 0
                ? `${Math.abs(doc.days_remaining)} days overdue`
                : `${doc.days_remaining} days`
              : '—'}
          </span>
        </div>
      </div>
      {viewUrl && (
        <div>
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <FileText className="h-3.5 w-3.5" />
            View document
          </a>
        </div>
      )}

      {(doc.assigned_driver_name || doc.contact_phone || doc.contact_email) && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Responsible / Contact
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {doc.assigned_driver_name && (
              <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                <User className="h-3.5 w-3.5" />
                {doc.assigned_driver_name}
              </span>
            )}
            {doc.contact_phone && (
              <a
                href={`tel:${doc.contact_phone}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Phone className="h-3.5 w-3.5" />
                Call
              </a>
            )}
            {doc.contact_email && (
              <a
                href={`mailto:${doc.contact_email}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </a>
            )}
            {doc.contact_phone && (
              <a
                href={`https://wa.me/${doc.contact_phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-green-600 hover:underline"
              >
                WhatsApp
              </a>
            )}
            <Button variant="outline" size="sm" onClick={copyTemplate} className="h-8 text-xs">
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy message template
            </Button>
          </div>
        </div>
      )}

      {canAssignSpare && (doc.status === 'expiring_soon' || doc.status === 'expired') && (
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={openSpareModal} className="h-8 text-xs">
            Assign spare vehicle
          </Button>
        </div>
      )}

      {showSpareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Assign spare vehicle</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSpareModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Select a spare vehicle to cover for <strong>{doc.vehicle_label}</strong>.
              </p>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={selectedSpareId ?? ''}
                onChange={(e) => setSelectedSpareId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Select spare vehicle…</option>
                {spareVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Reason (optional)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSpareModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submitAssignSpare}
                  disabled={!selectedSpareId || assigning}
                >
                  {assigning ? 'Saving…' : 'Assign'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
