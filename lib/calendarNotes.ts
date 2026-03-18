/**
 * Calendar day notes: types and date helpers.
 * Data access is via API routes; this file holds shared types and utilities.
 */

export interface CalendarDayNote {
  id: number
  note_date: string
  note_text: string
  created_by: number | null
  updated_by: number | null
  created_at: string
  updated_at: string
  created_by_name?: string | null
  updated_by_name?: string | null
}

/** First day of month (YYYY-MM-DD) and last day for a given year/month (1-based month). */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}
