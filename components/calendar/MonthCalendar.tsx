'use client'

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  eachDayOfInterval,
  parseISO,
  isSameDay,
} from 'date-fns'
import { Button } from '@/components/ui/Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayNoteSlideOver } from './DayNoteSlideOver'
import type { CalendarDayNote } from '@/lib/calendarNotes'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface MonthCalendarProps {
  year: number
  month: number
  notes: CalendarDayNote[]
  seenDates: string[]
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onDayClick: (date: string) => void
  selectedDate: string | null
  notesForSelectedDay: CalendarDayNote[]
  newNoteText: string
  isSaving: boolean
  error: string | null
  onNewNoteChange: (text: string) => void
  onAddNote: () => void
  onUpdateNote: (id: number, note_text: string) => void
  onDeleteNote: (id: number) => void
  onClosePanel: () => void
  onMarkSeen: (date: string) => void
}

export function MonthCalendar({
  year,
  month,
  notes,
  seenDates,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDayClick,
  selectedDate,
  notesForSelectedDay,
  newNoteText,
  isSaving,
  error,
  onNewNoteChange,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onClosePanel,
  onMarkSeen,
}: MonthCalendarProps) {
  const monthStart = startOfMonth(new Date(year, month - 1))
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const notesByDate = notes.reduce<Record<string, CalendarDayNote[]>>((acc, n) => {
    if (!acc[n.note_date]) acc[n.note_date] = []
    acc[n.note_date].push(n)
    return acc
  }, {})
  const hasNoteOnDate = (dateStr: string) => (notesByDate[dateStr]?.length ?? 0) > 0

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    onDayClick(dateStr)
    if (hasNoteOnDate(dateStr)) onMarkSeen(dateStr)
  }

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
            <Button variant="secondary" size="sm" onClick={onPrevMonth} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={onToday}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={onNextMonth} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4">
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
              const hasNote = hasNoteOnDate(dateStr)
              const isSeen = seenDates.includes(dateStr)
              const showDot = hasNote
              const isCurrentMonth = isSameMonth(day, monthStart)
              const isSelected = selectedDate && isSameDay(parseISO(selectedDate), day)

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`
                    min-h-[72px] p-2 text-left bg-white hover:bg-slate-50 transition-colors flex flex-col items-start
                    ${!isCurrentMonth ? 'text-slate-400' : 'text-slate-900'}
                    ${isSelected ? 'ring-2 ring-inset ring-primary bg-primary/5' : ''}
                  `}
                >
                  <span className={`
                    inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium
                    ${isToday(day) ? 'bg-primary text-white' : ''}
                  `}>
                    {format(day, 'd')}
                  </span>
                  {showDot && (
                    <span
                      className={`mt-1 h-2 w-2 rounded-full shrink-0 ${isSeen ? 'bg-blue-500' : 'bg-rose-500'}`}
                      aria-label={isSeen ? 'Note read' : 'Has update'}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <DayNoteSlideOver
        isOpen={!!selectedDate}
        onClose={onClosePanel}
        selectedDate={selectedDate}
        selectedDateLabel={selectedDateLabel}
        notes={notesForSelectedDay}
        newNoteText={newNoteText}
        isSaving={isSaving}
        onNewNoteChange={onNewNoteChange}
        onAddNote={onAddNote}
        onUpdateNote={onUpdateNote}
        onDeleteNote={onDeleteNote}
        error={error}
      />
    </>
  )
}
