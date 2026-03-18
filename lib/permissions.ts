/**
 * RBAC Permission Map for County Cars Dashboard
 * Maps routes/pages to required permissions.
 * RLS enforces at DB level; this is for UI (hide nav, route guards).
 */

export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  // Top-level
  '/dashboard': 'reports.read',
  '/dashboard/calendar': 'reports.read',
  '/dashboard/compliance': 'compliance.read',
  '/dashboard/compliance/vehicles/calendar': ['compliance.read', 'vehicle_documents.read'],
  '/dashboard/route-activity': 'reports.read',
  '/dashboard/school-overview': 'reports.read',
  '/dashboard/spares': 'routes.write',

  // People
  '/dashboard/employees': 'employees.read',
  '/dashboard/drivers': 'employees.read',
  '/dashboard/assistants': 'employees.read',
  '/dashboard/passengers': 'passengers.read',

  // Operations
  '/dashboard/routes': 'routes.read',
  '/dashboard/schools': 'routes.read',
  '/dashboard/incidents': 'routes.read',
  '/dashboard/appointments': 'passengers.read',
  '/dashboard/call-logs': 'passengers.read',
  '/dashboard/email-summaries': 'reports.read',

  // Vehicles
  '/dashboard/vehicles': 'vehicles.read',
  '/dashboard/vehicle-locations': 'vehicles.read',

  // Maintenance
  '/dashboard/maintenance/questions': 'maintenance_questions.view',
  '/dashboard/maintenance/questions/new': 'maintenance_questions.create',

  // Reports
  '/dashboard/summaries': 'reports.read',
  '/dashboard/vehicle-pre-checks': 'reports.read',
  '/dashboard/certificates-expiry/employees': ['employees.read', 'compliance.read'],
  '/dashboard/certificates-expiry/vehicles': ['vehicle_documents.read', 'compliance.read'],

  // Admin
  '/dashboard/admin/document-requirements': 'document_requirements.write',
  '/dashboard/admin/users': 'users.manage',
  '/dashboard/admin/roles': 'roles.assign',
  '/dashboard/admin/user-approvals': 'users.manage',
  '/dashboard/admin/notifications': ['notifications.send.single', 'notifications.send.route_parents', 'notifications.send.route_crew'],
  '/dashboard/my-notifications': 'notifications.inbox',
}

/** Check if user has permission for a route (prefix match) */
export function canAccessRoute(pathname: string, permissions: Set<string>): boolean {
  if (permissions.size === 0) return false
  const keys = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)
  for (const route of keys) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      const required = ROUTE_PERMISSIONS[route]
      const arr = Array.isArray(required) ? required : [required]
      return arr.some((p) => permissions.has(p))
    }
  }
  // Default: allow dashboard root if they have any permission
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return permissions.size > 0
  }
  return false
}

/** Get required permission(s) for a path */
export function getRequiredPermission(pathname: string): string[] {
  const keys = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length)
  for (const route of keys) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      const required = ROUTE_PERMISSIONS[route]
      return Array.isArray(required) ? required : [required]
    }
  }
  return []
}
