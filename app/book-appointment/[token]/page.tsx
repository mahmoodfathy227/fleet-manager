'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { formatDateTime } from '@/lib/utils'

interface AppointmentSlot {
  id: number
  slot_start: string
  slot_end: string
  notes: string | null
  appointment_bookings?: { id: number }[] | null
}

export default function BookAppointmentPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params?.token ?? null
  const supabase = createClient()
  const [slots, setSlots] = useState<AppointmentSlot[]>([])
  const [slotId, setSlotId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingNotification, setLoadingNotification] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadNotification = async () => {
      if (!token) return
      try {
        const { data, error: fetchError } = await supabase
          .from('notifications')
          .select('*, recipient:recipient_employee_id(full_name, personal_email)')
          .eq('email_token', token)
          .single()

        if (fetchError || !data) {
          setError('Invalid or expired appointment link')
          setLoadingNotification(false)
          return
        }

        // Auto-fill name and email from notification
        if (data.recipient?.full_name) {
          setName(data.recipient.full_name)
        } else if (data.recipient_email) {
          // Use email username as fallback
          const emailParts = data.recipient_email.split('@')
          if (emailParts[0]) {
            setName(emailParts[0].replace(/[._]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()))
          }
        }

        if (data.recipient?.personal_email) {
          setEmail(data.recipient.personal_email)
        } else if (data.recipient_email) {
          setEmail(data.recipient_email)
        }

        setLoadingNotification(false)
      } catch (err: any) {
        setError(err.message || 'Failed to load notification')
        setLoadingNotification(false)
      }
    }

    loadNotification()
  }, [token, supabase])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/appointments/slots')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load slots')
        const available = (data.slots || []).filter(
          (s: AppointmentSlot) => !s.appointment_bookings || s.appointment_bookings.length === 0
        )
        setSlots(available)
      } catch (err: any) {
        setError(err.message)
      }
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slotId) {
      setError('Please select a slot')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slotId, name: name || null, email: email || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to book appointment')
      setSuccess(true)
      setTimeout(() => router.push('/'), 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loadingNotification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-xl w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-xl w-full">
        <CardHeader>
          <CardTitle>Book an Appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success ? (
            <div className="rounded-md bg-green-50 p-4 text-green-800">
              Appointment booked! We will contact you if anything changes.
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label>Select a slot</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-2 bg-white">
                  {slots.length === 0 && (
                    <div className="text-sm text-gray-500">No available slots right now.</div>
                  )}
                  {slots.map((slot) => (
                    <label
                      key={slot.id}
                      className={`flex items-start space-x-2 p-2 rounded-md border ${
                        slotId === slot.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="slot"
                        value={slot.id}
                        checked={slotId === slot.id}
                        onChange={() => setSlotId(slot.id)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{formatDateTime(slot.slot_start)}</div>
                        <div className="text-sm text-gray-500">
                          Ends {formatDateTime(slot.slot_end)}
                        </div>
                        {slot.notes && <div className="text-xs text-gray-500 mt-1">{slot.notes}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <Button type="submit" disabled={loading || slots.length === 0}>
                {loading ? 'Booking...' : 'Book Appointment'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

