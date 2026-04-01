/**
 * Shared rules for /dashboard/compliance certificate_expiry list:
 * days from today (from expiry_date), and UX sort order (matches client table).
 */

import { daysFromTodayToExpiryDate } from '@/lib/expiryRelativeToToday'

export { daysFromTodayToExpiryDate, formatDaysFromTodayLabel } from '@/lib/expiryRelativeToToday'

/** Lower = show first: admin review → expired → urgent (≤7d) → rest; then sooner expiry; then newest created_at (then higher id). */
function pendingComplianceSortKey(n: {
  id: number
  expiry_date: string | null
  admin_response_required?: boolean | null
  created_at: string
}): [number, number, string, number] {
  const d = daysFromTodayToExpiryDate(n.expiry_date)
  const admin = !!n.admin_response_required
  let band: number
  if (admin) band = 0
  else if (d < 0) band = 1
  else if (d <= 7) band = 2
  else band = 3
  const ymd = String(n.expiry_date || '').slice(0, 10)
  const t = Date.parse(n.created_at)
  const newestFirst = Number.isFinite(t) ? -t : 0
  return [band, d, ymd, newestFirst]
}

export function sortPendingComplianceNotifications<
  T extends { id: number; expiry_date: string | null; admin_response_required?: boolean | null; created_at: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ka = pendingComplianceSortKey(a)
    const kb = pendingComplianceSortKey(b)
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] < kb[i]) return -1
      if (ka[i] > kb[i]) return 1
    }
    return b.id - a.id
  })
}

export type ComplianceListSortMode = 'importance' | 'newest' | 'oldest'

function sortPendingComplianceByModeCore<
  T extends { id: number; expiry_date: string | null; admin_response_required?: boolean | null; created_at: string },
>(items: T[], mode: ComplianceListSortMode): T[] {
  if (mode === 'importance') return sortPendingComplianceNotifications(items)
  if (mode === 'newest') {
    return [...items].sort((a, b) => {
      const ta = Date.parse(a.created_at)
      const tb = Date.parse(b.created_at)
      if (Number.isFinite(tb) && Number.isFinite(ta) && tb !== ta) return tb - ta
      return b.id - a.id
    })
  }
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.created_at)
    const tb = Date.parse(b.created_at)
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb
    return a.id - b.id
  })
}

/**
 * Pending rows: importance = admin → expired → due soon → rest; newest/oldest = by created_at.
 * When `userPinnedIds` is non-empty, those notification ids are sorted first (same mode within each group),
 * so user-marked admin rows stay on top for every sort option.
 */
export function sortPendingComplianceByMode<
  T extends { id: number; expiry_date: string | null; admin_response_required?: boolean | null; created_at: string },
>(items: T[], mode: ComplianceListSortMode, userPinnedIds?: Set<number>): T[] {
  if (!userPinnedIds || userPinnedIds.size === 0) return sortPendingComplianceByModeCore(items, mode)
  const pinned = items.filter((n) => userPinnedIds.has(n.id))
  const rest = items.filter((n) => !userPinnedIds.has(n.id))
  return [
    ...sortPendingComplianceByModeCore(pinned, mode),
    ...sortPendingComplianceByModeCore(rest, mode),
  ]
}

export function sortResolvedComplianceNotifications<
  T extends { resolved_at: string | null; created_at: string; id: number },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = (a.resolved_at || a.created_at || '').slice(0, 19)
    const tb = (b.resolved_at || b.created_at || '').slice(0, 19)
    const c = tb.localeCompare(ta)
    if (c !== 0) return c
    return b.id - a.id
  })
}

function sortResolvedComplianceByModeCore<
  T extends { resolved_at: string | null; created_at: string; id: number },
>(items: T[], mode: ComplianceListSortMode): T[] {
  if (mode === 'importance') return sortResolvedComplianceNotifications(items)
  return [...items].sort((a, b) => {
    const ra = (a.resolved_at || a.created_at || '').slice(0, 19)
    const rb = (b.resolved_at || b.created_at || '').slice(0, 19)
    const c = mode === 'newest' ? rb.localeCompare(ra) : ra.localeCompare(rb)
    if (c !== 0) return c
    return mode === 'newest' ? b.id - a.id : a.id - b.id
  })
}

/** Resolved/dismissed: same as core; user-pinned ids first when set is non-empty. */
export function sortResolvedComplianceByMode<
  T extends {
    resolved_at: string | null
    created_at: string
    id: number
    admin_response_required?: boolean | null
  },
>(items: T[], mode: ComplianceListSortMode, userPinnedIds?: Set<number>): T[] {
  if (!userPinnedIds || userPinnedIds.size === 0) return sortResolvedComplianceByModeCore(items, mode)
  const pinned = items.filter((n) => userPinnedIds.has(n.id))
  const rest = items.filter((n) => !userPinnedIds.has(n.id))
  return [
    ...sortResolvedComplianceByModeCore(pinned, mode),
    ...sortResolvedComplianceByModeCore(rest, mode),
  ]
}

/** Single list for SSR → client: pending then resolved, each newest-first by default. */
export function orderComplianceNotificationsListForPage<
  T extends {
    status: string
    id: number
    expiry_date: string | null
    admin_response_required?: boolean | null
    created_at: string
    resolved_at: string | null
  },
>(items: T[]): T[] {
  const pending = items.filter((n) => n.status !== 'resolved' && n.status !== 'dismissed')
  const resolved = items.filter((n) => n.status === 'resolved' || n.status === 'dismissed')
  return [
    ...sortPendingComplianceByMode(pending, 'newest'),
    ...sortResolvedComplianceByMode(resolved, 'newest'),
  ]
}
