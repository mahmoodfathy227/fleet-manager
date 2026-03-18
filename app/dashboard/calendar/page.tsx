'use client'

import { useState, useEffect, useCallback } from 'react'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import type { CalendarDayNote } from '@/lib/calendarNotes'
import { addMonths, subMonths } from 'date-fns'
import { createClient } from '@/lib/supabase/client'

export default function CalendarPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [notes, setNotes] = useState<CalendarDayNote[]>([])
  const [seenDates, setSeenDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [newNoteText, setNewNoteText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthParam = `${year}-${String(month).padStart(2, '0')}`

  const loadMonth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/notes?month=${monthParam}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load notes')
      setNotes(data.notes || [])
      setSeenDates(data.seen_dates || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [monthParam])

  useEffect(() => {
    loadMonth()
  }, [loadMonth])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('calendar-day-notes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_day_notes' },
        () => { loadMonth() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_day_note_views' },
        () => { loadMonth() }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadMonth])

  const notesForSelectedDay = selectedDate
    ? notes
        .filter((n) => n.note_date === selectedDate)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : []

  useEffect(() => {
    if (selectedDate && notesForSelectedDay.length > 0) onMarkSeen(selectedDate)
  }, [selectedDate, notesForSelectedDay.length])

  const onDayClick = (date: string) => {
    setSelectedDate(date)
    setError(null)
  }

  const onClosePanel = () => {
    setSelectedDate(null)
    setNewNoteText('')
    setError(null)
  }

  const onAddNote = async () => {
    if (!selectedDate || !newNoteText.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/calendar/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_date: selectedDate, note_text: newNoteText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setNewNoteText('')
      await loadMonth()
    } catch (e: any) {
      setError(e.message || 'Failed to add update')
    } finally {
      setIsSaving(false)
    }
  }

  const onUpdateNote = async (id: number, note_text: string) => {
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/calendar/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, note_text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      await loadMonth()
    } catch (e: any) {
      setError(e.message || 'Failed to update')
    } finally {
      setIsSaving(false)
    }
  }

  const onDeleteNote = async (id: number) => {
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/notes?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      await loadMonth()
    } catch (e: any) {
      setError(e.message || 'Failed to delete')
    } finally {
      setIsSaving(false)
    }
  }

  const onMarkSeen = async (date: string) => {
    if (seenDates.includes(date)) return
    setSeenDates((prev) => (prev.includes(date) ? prev : [...prev, date]))
    try {
      await fetch('/api/calendar/notes/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_date: date }),
      })
    } catch {
      // best-effort; dot already cleared optimistically
    }
  }

  const goPrev = () => {
    const d = new Date(year, month - 1, 1)
    const prev = subMonths(d, 1)
    setYear(prev.getFullYear())
    setMonth(prev.getMonth() + 1)
  }

  const goNext = () => {
    const d = new Date(year, month - 1, 1)
    const next = addMonths(d, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth() + 1)
  }

  const goToday = () => {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Main Calendar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Click a day to view or add updates. You can add multiple updates per day; each shows a timestamp. Days with updates show a dot until you view them.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
          Loading calendar…
        </div>
      ) : (
        <MonthCalendar
          year={year}
          month={month}
          notes={notes}
          seenDates={seenDates}
          onPrevMonth={goPrev}
          onNextMonth={goNext}
          onToday={goToday}
          onDayClick={onDayClick}
          selectedDate={selectedDate}
          notesForSelectedDay={notesForSelectedDay}
          newNoteText={newNoteText}
          isSaving={isSaving}
          error={error}
          onNewNoteChange={setNewNoteText}
          onAddNote={onAddNote}
          onUpdateNote={onUpdateNote}
          onDeleteNote={onDeleteNote}
          onClosePanel={onClosePanel}
          onMarkSeen={onMarkSeen}
        />
      )}
    </div>
  )
}
