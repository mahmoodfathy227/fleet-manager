'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { cn, formatDateTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock } from 'lucide-react'

interface AppointmentBooking {
  id: number
  notification_id: number | null
  booked_by_email: string | null
  booked_by_name: string | null
  status: string | null
  booked_at: string | null
  notes: string | null
}

interface IntendedCrew {
  id: number
  full_name: string | null
  personal_email: string | null
}

interface AppointmentSlot {
  id: number
  slot_start: string
  slot_end: string
  notes: string | null
  planned_booking_context?: string | null
  assigned_employee_id?: number | null
  /** Populated from GET normalization (joined employee for intended crew). */
  intended_crew?: IntendedCrew | null
  appointment_bookings?: AppointmentBooking[] | null
}

interface CrewOption {
  id: number
  full_name: string
}

type SlotFormState = {
  date: string
  startTime: string
  endTime: string
  notes: string
  plannedBookingContext: string
  assignedEmployeeId: string
}

/** Defaults: today (local) + common slot times so controlled inputs have real values (not empty/grey). */
function createDefaultSlotForm(): SlotFormState {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const defaults: SlotFormState = {
    date: `${y}-${m}-${day}`,
    startTime: '12:30',
    endTime: '13:30',
    notes: '',
    plannedBookingContext: '',
    assignedEmployeeId: '',
  }
  console.debug('[fleet] appointments: createDefaultSlotForm', defaults)
  return defaults
}

/** Build a local Date from `type="date"` (yyyy-mm-dd) and `type="time"` (hh:mm or hh:mm:ss). */
function parseSlotLocalDateTime(dateYmd: string, timeHmOrHms: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeHmOrHms.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  const s = m[3] != null ? Number(m[3]) : 0
  if (h > 23 || min > 59 || s > 59) return null
  const hh = String(h).padStart(2, '0')
  const mm = String(min).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  const d = new Date(`${dateYmd}T${hh}:${mm}:${ss}`)
  return Number.isNaN(d.getTime()) ? null : d
}

export default function AppointmentsPage() {
  const slotsSectionRef = useRef<HTMLDivElement>(null)
  const [slots, setSlots] = useState<AppointmentSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [crewOptions, setCrewOptions] = useState<CrewOption[]>([])
  const [highlightSlotId, setHighlightSlotId] = useState<number | null>(null)
  const [form, setForm] = useState<SlotFormState>(() => createDefaultSlotForm())

  const loadSlots = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/appointments/slots?order=newest')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load slots')
      const list = data.slots || []
      console.debug('[fleet] appointments page: slots loaded (newest first)', list.length)
      setSlots(list)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.debug('[fleet] appointments page: slot form includes planned booking context + intended crew')
    console.debug('[fleet] appointments page: native date/time pickers enabled for slot creation')
    loadSlots()
  }, [])

  useEffect(() => {
    if (highlightSlotId == null) return
    const rowPresent = slots.some((s) => s.id === highlightSlotId)
    if (!rowPresent) return

    const sectionEl = slotsSectionRef.current
    const rowEl = document.getElementById(`appointment-slot-row-${highlightSlotId}`)
    console.debug('[fleet] appointments: scroll + highlight new slot', highlightSlotId, {
      hasSection: !!sectionEl,
      hasRow: !!rowEl,
    })
    sectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    rowEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const t = window.setTimeout(() => {
      console.debug('[fleet] appointments: clearing new slot highlight', highlightSlotId)
      setHighlightSlotId(null)
    }, 2000)
    return () => window.clearTimeout(t)
  }, [highlightSlotId, slots])

  useEffect(() => {
    const supabase = createClient()
    void (async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('employment_status', 'Active')
        .order('full_name')
      if (error) {
        console.error('[fleet] appointments page: crew list load failed', error.message)
        return
      }
      setCrewOptions(
        (data || []).map((r: { id: number; full_name: string | null }) => ({
          id: r.id,
          full_name: r.full_name?.trim() || `Employee #${r.id}`,
        }))
      )
      console.debug('[fleet] appointments page: crew options for slot form', (data || []).length)
    })()
  }, [])

  const createSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // noValidate on the form: native type="date"/"time" tooltips can falsely fire when the
    // visible locale text does not match a valid yyyy-mm-dd / HH:mm value in the DOM.
    if (!form.date || !form.startTime || !form.endTime) {
      console.debug('[fleet] appointments createSlot: missing required fields', {
        hasDate: !!form.date,
        hasStart: !!form.startTime,
        hasEnd: !!form.endTime,
      })
      setError('Date, start time, and end time are required')
      return
    }

    const ymd = /^\d{4}-\d{2}-\d{2}$/
    if (!ymd.test(form.date)) {
      console.debug('[fleet] appointments createSlot: date must be YYYY-MM-DD from picker', form.date)
      setError('Please choose a valid date using the date picker')
      return
    }

    const slotStart = parseSlotLocalDateTime(form.date, form.startTime)
    const slotEnd = parseSlotLocalDateTime(form.date, form.endTime)
    if (!slotStart || !slotEnd) {
      console.debug('[fleet] appointments createSlot: invalid Date from parts', {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
      })
      setError('Could not read date and time — pick the date and times again')
      return
    }

    if (slotEnd <= slotStart) {
      setError('End time must be after start time')
      return
    }

    const payload = {
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
      notes: form.notes || null,
      plannedBookingContext: form.plannedBookingContext.trim() || null,
      assignedEmployeeId: form.assignedEmployeeId ? parseInt(form.assignedEmployeeId, 10) : null,
    }
    console.debug('[fleet] appointments createSlot: posting slot payload', {
      slotStart: payload.slotStart,
      slotEnd: payload.slotEnd,
      hasNotes: !!payload.notes,
      hasContext: !!payload.plannedBookingContext,
      assignedEmployeeId: payload.assignedEmployeeId,
    })

    setCreating(true)
    try {
      const res = await fetch('/api/appointments/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotStart: payload.slotStart,
          slotEnd: payload.slotEnd,
          notes: payload.notes,
          plannedBookingContext: payload.plannedBookingContext,
          assignedEmployeeId: payload.assignedEmployeeId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create slot')
      const newSlotId = typeof data.slot?.id === 'number' ? data.slot.id : null
      console.debug('[fleet] appointments createSlot: created slot id', newSlotId)
      setForm(createDefaultSlotForm())
      await loadSlots()
      if (newSlotId != null) {
        console.debug('[fleet] appointments createSlot: scheduling scroll/highlight', newSlotId)
        setHighlightSlotId(newSlotId)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
            <Calendar className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Appointments</h1>
            <p className="text-sm text-slate-500">Create available slots and view bookings</p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <CardTitle className="text-slate-900 text-base font-semibold">Create Slot</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={createSlot} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">
                Date <span className="text-red-600">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => {
                  const v = e.target.value
                  console.debug('[fleet] appointments slot form: date changed', v)
                  setForm((prev) => ({ ...prev, date: v }))
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">
                Start Time <span className="text-red-600">*</span>
              </Label>
              <Input
                id="start"
                type="time"
                value={form.startTime}
                onChange={(e) => {
                  const v = e.target.value
                  console.debug('[fleet] appointments slot form: start time changed', v)
                  setForm((prev) => ({ ...prev, startTime: v }))
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">
                End Time <span className="text-red-600">*</span>
              </Label>
              <Input
                id="end"
                type="time"
                value={form.endTime}
                onChange={(e) => {
                  const v = e.target.value
                  console.debug('[fleet] appointments slot form: end time changed', v)
                  setForm((prev) => ({ ...prev, endTime: v }))
                }}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Slot notes (optional)</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Location or instructions for the slot"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="booking-context">Booking context (optional)</Label>
              <textarea
                id="booking-context"
                value={form.plannedBookingContext}
                onChange={(e) => setForm((prev) => ({ ...prev, plannedBookingContext: e.target.value }))}
                placeholder="e.g. TAS Badge renewal — shown as booking context until someone books"
                rows={2}
                className="flex w-full min-h-[72px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="crew">Intended crew member (optional)</Label>
              <Select
                id="crew"
                selectSize="sm"
                value={form.assignedEmployeeId}
                onChange={(e) => setForm((prev) => ({ ...prev, assignedEmployeeId: e.target.value }))}
                className="border-slate-200"
              >
                <option value="">None — slot stays open until booked</option>
                {crewOptions.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-slate-500">
                Shown on the grid as the intended assignee until a real booking is made from an appointment link.
              </p>
            </div>
            <div className="md:col-span-2 flex justify-end space-x-2">
              {error && <span className="text-sm text-red-600">{error}</span>}
              <Button type="submit" disabled={creating}>
                {creating ? 'Saving...' : 'Add Slot'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card
        ref={slotsSectionRef}
        className="overflow-hidden border-slate-200 scroll-mt-6"
        id="slots-bookings-section"
      >
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <CardTitle className="text-slate-900 text-base font-semibold">Slots & Bookings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slot</TableHead>
                <TableHead>Slot notes</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Booking context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : slots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No slots yet</p>
                    <p className="text-sm text-slate-400">Create one above to get started</p>
                  </TableCell>
                </TableRow>
              ) : (
                slots.map((slot) => {
                  const booking = slot.appointment_bookings?.[0]
                  const intended = slot.intended_crew
                  const contextText = booking?.notes?.trim() || slot.planned_booking_context?.trim() || null
                  return (
                    <TableRow
                      key={slot.id}
                      id={`appointment-slot-row-${slot.id}`}
                      className={cn(
                        highlightSlotId === slot.id
                          ? 'bg-blue-50 ring-2 ring-blue-400/70 ring-inset z-[1] shadow-sm'
                          : 'hover:bg-slate-50'
                      )}
                    >
                      <TableCell>
                        <div className="font-semibold text-slate-800">{formatDateTime(slot.slot_start)}</div>
                        <div className="text-sm text-slate-500">
                          Ends {formatDateTime(slot.slot_end)}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{slot.notes || '-'}</TableCell>
                      <TableCell>
                        {booking ? (
                          <div className="space-y-1">
                            <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-700">Booked</span>
                            <div className="text-sm text-slate-600">
                              {booking.booked_by_name || booking.booked_by_email || 'Recipient'}
                            </div>
                            <div className="text-xs text-slate-400">
                              {booking.booked_at ? formatDateTime(booking.booked_at) : ''}
                            </div>
                          </div>
                        ) : intended?.full_name ? (
                          <div className="space-y-1">
                            <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800">Intended</span>
                            <div className="text-sm text-slate-600">{intended.full_name}</div>
                            {intended.personal_email ? (
                              <div className="text-xs text-slate-400">{intended.personal_email}</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">Available</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-[280px]">
                        {contextText ? (
                          <span className="text-sm whitespace-pre-wrap break-words" title={contextText}>
                            {contextText}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

