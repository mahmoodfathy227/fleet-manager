import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { Bell, Activity } from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { RouteActivityNotificationsClient } from './RouteActivityNotificationsClient'
import { RefreshNotificationsButton } from '../notifications/RefreshNotificationsButton'

async function getRouteActivityNotifications() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      recipient:recipient_employee_id(full_name, personal_email)
    `)
    .in('notification_type', ['vehicle_breakdown', 'driver_tardiness'])
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
    console.error('Error fetching route activity notifications:', error)
    return []
  }

  return data || []
}

async function getPendingCount() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('notification_type', ['vehicle_breakdown', 'driver_tardiness'])
    .eq('status', 'pending')

  if (error) {
    console.error('Error counting notifications:', error)
    return 0
  }

  return data?.length || 0
}

export default async function RouteActivityPage() {
  const notifications = await getRouteActivityNotifications()
  const pendingCount = await getPendingCount()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Route Activity</h1>
          <p className="text-sm text-slate-500">Vehicle breakdowns and driver tardiness notifications</p>
        </div>
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700">
              <Bell className="h-4 w-4" />
              <span className="text-sm font-medium">{pendingCount} pending</span>
            </div>
          )}
          <RefreshNotificationsButton />
        </div>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <RouteActivityNotificationsClient initialNotifications={notifications} />
      </Suspense>
    </div>
  )
}


