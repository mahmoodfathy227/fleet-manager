import { createClient } from '@/lib/supabase/server'
import React, { Suspense } from 'react'
import { Bell } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { ComplianceNotificationsClient } from './ComplianceNotificationsClient'
import { orderComplianceNotificationsListForPage } from '@/lib/complianceNotificationsDisplay'

/** Shown on Compliance page: vehicle + staff certificate due dates only (trip cancellations live under Route Activity). */
const COMPLIANCE_PAGE_NOTIFICATION_TYPES = ['certificate_expiry'] as const

async function getComplianceNotifications() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      recipient:recipient_employee_id(full_name, personal_email)
    `)
    .in('notification_type', [...COMPLIANCE_PAGE_NOTIFICATION_TYPES])
    .order('created_at', { ascending: false })
    .limit(100)

  // Parse details JSONB field if it exists
  if (data) {
    data.forEach((notification: any) => {
      if (notification.details && typeof notification.details === 'string') {
        try {
          notification.details = JSON.parse(notification.details)
        } catch (e) {
          // Keep as is if not valid JSON
        }
      }
    })
  }

  if (error) {
    console.error('Error fetching compliance notifications:', error)
    return []
  }

  const rows = data || []
  console.debug(
    '[fleet] compliance page SSR: types',
    COMPLIANCE_PAGE_NOTIFICATION_TYPES,
    'count',
    rows.length
  )
  console.debug('[fleet] compliance page SSR: notifications ordered newest first (pending then resolved)')
  return orderComplianceNotificationsListForPage(
    rows as {
      id: number
      status: string
      expiry_date: string | null
      admin_response_required?: boolean | null
      created_at: string
      resolved_at: string | null
    }[]
  )
}

async function getPendingCount() {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('notification_type', [...COMPLIANCE_PAGE_NOTIFICATION_TYPES])
    .or('status.eq.pending,admin_response_required.eq.true')

  if (error) {
    console.error('Error counting notifications:', error)
    return 0
  }

  console.debug('[fleet] compliance page SSR: pending count (certificate_expiry only)', count ?? 0)
  return count ?? 0
}

export default async function CompliancePage() {
  const notifications = await getComplianceNotifications()
  const pendingCount = await getPendingCount()

  console.debug('[fleet] compliance page: UI copy — due dates only; trip cancellations → /dashboard/route-activity')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">

          <div>
            <h1 className="text-2xl font-bold text-slate-900">Compliance — due dates</h1>
            <p className="text-sm text-slate-500">
              Vehicles and staff with certificates approaching or past expiry — parent trip cancellations are under Route Activity.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700">
              <Bell className="h-4 w-4" />
              <span className="text-sm font-medium">{pendingCount} pending</span>
            </div>
          )}
        </div>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <ComplianceNotificationsClient
          initialNotifications={notifications as React.ComponentProps<typeof ComplianceNotificationsClient>['initialNotifications']}
        />
      </Suspense>
    </div>
  )
}


