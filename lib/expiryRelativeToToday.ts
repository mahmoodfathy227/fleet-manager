const MS_PER_DAY = 86_400_000

function localCalendarYmd(d: Date): { y: number; m: number; day: number } {
  return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() }
}

function ordinalDayUTC(y: number, m: number, day: number): number {
  return Math.floor(Date.UTC(y, m - 1, day) / MS_PER_DAY)
}

/**
 * Whole calendar days from **today** (local date) to the **expiry date** (date-only).
 * Positive = expiry is in the future (days remaining), zero = due today, negative = already expired.
 * Matches Postgres `(expiry_date::date - CURRENT_DATE)` for DATE columns.
 */
export function daysFromTodayToExpiryDate(expiryDate: string | null | undefined): number {
  if (expiryDate == null || String(expiryDate).trim() === '') return 0
  const raw = String(expiryDate).trim()
  const ymd = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? raw.slice(0, 10)
  const parts = ymd.split('-').map((v) => parseInt(v, 10))
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return 0
  const [ey, em, ed] = parts
  const { y: ty, m: tm, day: td } = localCalendarYmd(new Date())
  return ordinalDayUTC(ey, em, ed) - ordinalDayUTC(ty, tm, td)
}

/** Short UI/email copy for a `daysFromTodayToExpiryDate` value. */
export function formatDaysFromTodayLabel(days: number): string {
  if (days < 0) {
    const n = Math.abs(days)
    return `Expired ${n} day${n === 1 ? '' : 's'} ago`
  }
  if (days === 0) return 'Due today'
  return `In ${days} day${days === 1 ? '' : 's'}`
}
