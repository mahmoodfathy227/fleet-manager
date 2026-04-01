const STORAGE_KEY = 'fleet_compliance_user_admin_pin_ids'

/** IDs the user marked for admin focus on the compliance table (persisted in localStorage). */
export function loadUserAdminPinIds(): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)))
  } catch {
    return new Set()
  }
}

export function saveUserAdminPinIds(ids: Set<number>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids).sort((a, b) => a - b)))
    console.debug('[fleet] complianceUserAdminPins: saved', ids.size, 'ids')
  } catch {
    /* quota / private mode */
  }
}
