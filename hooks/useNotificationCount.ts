'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useNotificationCount() {
  const [count, setCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Initial count fetch
    const fetchCount = async () => {
      const { count: pendingCount, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .or('status.eq.pending,admin_response_required.eq.true')

      if (!error && pendingCount !== null) {
        setCount(pendingCount)
      } else if (error) {
        console.error('Error fetching notification count:', error)
        setCount(0)
      }
      setIsLoading(false)
    }

    fetchCount()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('notifications_count_channel')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'notifications',
        },
        () => {
          // Refetch count when any notification changes
          fetchCount()
        }
      )
      .subscribe()

    // Listen for custom events to manually refresh count
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

