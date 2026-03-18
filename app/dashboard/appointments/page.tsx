'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/utils'
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

interface AppointmentSlot {
  id: number
  slot_start: string
  slot_end: string
  notes: string | null
  appointment_bookings?: AppointmentBooking[] | null
}

export default function AppointmentsPage() {
  const [slots, setSlots] = useState<AppointmentSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    notes: '',
  })

  const loadSlots = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/appointments/slots')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load slots')
      setSlots(data.slots || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSlots()
  }, [])

  const createSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.date || !form.startTime || !form.endTime) {
      setError('Date, start time, and end time are required')
      return
    }

    const slotStart = new Date(`${form.date}T${form.startTime}`)
    const slotEnd = new Date(`${form.date}T${form.endTime}`)

    if (slotEnd <= slotStart) {
      setError('End time must be after start time')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/appointments/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotStart: slotStart.toISOString(),
          slotEnd: slotEnd.toISOString(),
          notes: form.notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create slot')
      setForm({ date: '', startTime: '', endTime: '', notes: '' })
      loadSlots()
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
          <form onSubmit={createSlot} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Start Time</Label>
              <Input
                id="start"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End Time</Label>
              <Input
                id="end"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Location or instructions"
              />
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

      <Card className="overflow-hidden border-slate-200">
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
                  return (
                    <TableRow key={slot.id} className="hover:bg-slate-50">
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
                        ) : (
                          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">Available</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 max-w-[200px]">
                        {booking?.notes ? (
                          <span className="text-sm" title={booking.notes}>{booking.notes}</span>
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

