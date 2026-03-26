/** Shared logic for dashboard operations calendar (routes / schools / compliance on session days). */

export const ROUTES_CALENDAR_EXPIRY_TOLERANCE_DAYS = 14

/** Crew-focused (omit taxi/vehicle insurance/MOT on driver row — use vehicle compliance tab). */
export const DRIVER_EXPIRY_FIELDS: { key: string; label: string }[] = [
  { key: 'tas_badge_expiry_date', label: 'TAS Badge' },
  { key: 'dbs_expiry_date', label: 'DBS' },
  { key: 'first_aid_certificate_expiry_date', label: 'First Aid' },
  { key: 'passport_expiry_date', label: 'Passport' },
  { key: 'driving_license_expiry_date', label: 'Driving License' },
  { key: 'cpc_expiry_date', label: 'CPC' },
]

export const PA_EXPIRY_FIELDS: { key: string; label: string }[] = [
  { key: 'tas_badge_expiry_date', label: 'TAS Badge' },
  { key: 'dbs_expiry_date', label: 'DBS' },
]

export function sliceIsoDate(raw: string | null | undefined): string | null {
  if (raw == null || raw === '') return null
  const m = String(raw).trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/** Whole days from sessionDate to expiry (expiry - session), for calendar-day comparison. */
export function daysFromSessionToExpiry(sessionDate: string, expiryDate: string): number {
  const s = new Date(sessionDate + 'T12:00:00')
  const e = new Date(expiryDate + 'T12:00:00')
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
}

export type ExpiryIssueStatus = 'ok' | 'missing' | 'expired' | 'expiring_soon'

export function classifyExpiryOnSessionDay(
  sessionDate: string,
  expiryStr: string | null | undefined
): ExpiryIssueStatus {
  const exp = sliceIsoDate(expiryStr ?? null)
  if (!exp) return 'missing'
  const d = daysFromSessionToExpiry(sessionDate, exp)
  if (d < 0) return 'expired'
  if (d <= ROUTES_CALENDAR_EXPIRY_TOLERANCE_DAYS) return 'expiring_soon'
  return 'ok'
}

export type StaffExpiryIssue = {
  role: 'driver' | 'pa'
  employeeId: number
  fullName: string
  certLabel: string
  certKey: string
  expiryDate: string | null
  status: ExpiryIssueStatus
}

export function collectStaffExpiryIssuesForSession(
  sessionDate: string,
  driver: Record<string, unknown> | null | undefined,
  pa: Record<string, unknown> | null | undefined
): StaffExpiryIssue[] {
  const out: StaffExpiryIssue[] = []
  if (driver) {
    const eid = driver.employee_id as number
    const emp = driver.employees as { full_name?: string } | null | undefined
    const name = emp?.full_name ?? `Driver #${eid}`
    for (const { key, label } of DRIVER_EXPIRY_FIELDS) {
      const status = classifyExpiryOnSessionDay(sessionDate, driver[key] as string | null)
      if (status !== 'ok') {
        out.push({
          role: 'driver',
          employeeId: eid,
          fullName: name,
          certLabel: label,
          certKey: key,
          expiryDate: sliceIsoDate((driver[key] as string) ?? null),
          status,
        })
      }
    }
  }
  if (pa) {
    const eid = pa.employee_id as number
    const emp = pa.employees as { full_name?: string } | null | undefined
    const name = emp?.full_name ?? `PA #${eid}`
    for (const { key, label } of PA_EXPIRY_FIELDS) {
      const status = classifyExpiryOnSessionDay(sessionDate, pa[key] as string | null)
      if (status !== 'ok') {
        out.push({
          role: 'pa',
          employeeId: eid,
          fullName: name,
          certLabel: label,
          certKey: key,
          expiryDate: sliceIsoDate((pa[key] as string) ?? null),
          status,
        })
      }
    }
  }
  return out
}
