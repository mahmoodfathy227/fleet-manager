'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useComplianceNotificationCount() {
  const [count, setCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchCount = async () => {
      const { count: pendingCount, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('notification_type', 'certificate_expiry')
        .or('status.eq.pending,admin_response_required.eq.true')

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
          filter: 'notification_type=eq.certificate_expiry'
        },
        () => {
          fetchCount()
        }
      )
      .subscribe()

    const handleNotificationResolved = () => {
      fetchCount()
    }
    window.addEventListener('notificationResolved', handleNotificationResolved)

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('notificationResolved', handleNotificationResolved)
    }
  }, [])

  return { count, isLoading }
}

