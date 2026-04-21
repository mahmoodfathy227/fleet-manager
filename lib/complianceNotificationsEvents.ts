/** Fired when certificate_expiry notifications change so sidebar count can refetch without full reload. */
export const COMPLIANCE_NOTIFICATIONS_CHANGED_EVENT = 'complianceNotificationsChanged'

/** Fired when operational notifications change (e.g. trip cancellation, breakdown, delay) so Route Activity can refetch. */
export const ROUTE_ACTIVITY_NOTIFICATIONS_CHANGED_EVENT = 'routeActivityNotificationsChanged'

export function emitComplianceNotificationsChanged(source?: string) {
  if (typeof window === 'undefined') return
  console.debug('[fleet] complianceNotificationsChanged emit', source ?? 'unknown')
  window.dispatchEvent(new CustomEvent(COMPLIANCE_NOTIFICATIONS_CHANGED_EVENT))
}

export function emitRouteActivityNotificationsChanged(source?: string) {
  if (typeof window === 'undefined') return
  console.debug('[fleet] routeActivityNotificationsChanged emit', source ?? 'unknown')
  window.dispatchEvent(new CustomEvent(ROUTE_ACTIVITY_NOTIFICATIONS_CHANGED_EVENT))
}
