'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROUTE_ACTIVITY_NOTIFICATIONS_CHANGED_EVENT } from '@/lib/complianceNotificationsEvents'

export function useRouteActivityNotificationCount() {
  const [count, setCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchCount = async () => {
      const { count: pendingCount, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .in('notification_type', ['vehicle_breakdown', 'driver_tardiness'])
        .eq('status', 'pending')

      if (!error && pendingCount !== null) {
        setCount(pendingCount)
      } else if (error) {
        console.error('Error fetching route activity notification count:', error)
        setCount(0)
      }
      setIsLoading(false)
    }

    fetchCount()

    const channel = supabase
      .channel('route_activity_notifications_count_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: 'notification_type=in.(vehicle_breakdown,driver_tardiness)'
        },
        () => {
          fetchCount()
        }
      )
      .subscribe()

    const handleNotificationResolved = () => {
      fetchCount()
    }
    const handleRouteActivityNotificationsChanged = () => {
      console.debug('[fleet] useRouteActivityNotificationCount: routeActivityNotificationsChanged → refetch')
      fetchCount()
    }
    window.addEventListener('notificationResolved', handleNotificationResolved)
    window.addEventListener(ROUTE_ACTIVITY_NOTIFICATIONS_CHANGED_EVENT, handleRouteActivityNotificationsChanged)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('notificationResolved', handleNotificationResolved)
      window.removeEventListener(ROUTE_ACTIVITY_NOTIFICATIONS_CHANGED_EVENT, handleRouteActivityNotificationsChanged)
    }
  }, [])

  return { count, isLoading }
}

