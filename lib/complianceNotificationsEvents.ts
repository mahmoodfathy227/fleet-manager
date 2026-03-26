/** Fired when certificate_expiry / compliance notifications change so sidebar count can refetch without full reload. */
export const COMPLIANCE_NOTIFICATIONS_CHANGED_EVENT = 'complianceNotificationsChanged'

export function emitComplianceNotificationsChanged(source?: string) {
  if (typeof window === 'undefined') return
  console.debug('[fleet] complianceNotificationsChanged emit', source ?? 'unknown')
  window.dispatchEvent(new CustomEvent(COMPLIANCE_NOTIFICATIONS_CHANGED_EVENT))
}
