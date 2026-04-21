'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COMPLIANCE_NOTIFICATIONS_CHANGED_EVENT } from '@/lib/complianceNotificationsEvents'

const COMPLIANCE_COUNT_TYPES = 'certificate_expiry'

export function useComplianceNotificationCount() {
  const [count, setCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchCount = async () => {
      const { count: pendingCount, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .in('notification_type', ['certificate_expiry'])
        .or('status.eq.pending,admin_response_required.eq.true')

      console.debug('[fleet] useComplianceNotificationCount: refetch', pendingCount, error?.message ?? '')
      if (!error && pendingCount !== null) {
        setCount(pendingCount)
      } else if (error) {
        console.error('Error fetching compliance notification count:', error)
        setCount(0)
      }
      setIsLoading(false)
    }

    fetchCount()

    const channel = supabase
      .channel('compliance_notifications_count_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `notification_type=in.(${COMPLIANCE_COUNT_TYPES})`
        },
        () => {
          fetchCount()
        }
      )
      .subscribe()

    const handleNotificationResolved = () => {
      fetchCount()
    }
    const handleComplianceNotificationsChanged = () => {
      console.debug('[fleet] useComplianceNotificationCount: complianceNotificationsChanged → refetch')
      fetchCount()
    }
    window.addEventListener('notificationResolved', handleNotificationResolved)
    window.addEventListener(
      COMPLIANCE_NOTIFICATIONS_CHANGED_EVENT,
      handleComplianceNotificationsChanged
    )

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('notificationResolved', handleNotificationResolved)
      window.removeEventListener(
        COMPLIANCE_NOTIFICATIONS_CHANGED_EVENT,
        handleComplianceNotificationsChanged
      )
    }
  }, [])

  return { count, isLoading }
}

