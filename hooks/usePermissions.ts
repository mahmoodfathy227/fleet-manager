'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePermissions() {
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc('get_my_permissions')
        if (error) {
          console.error('Failed to load permissions:', error)
          setPermissions(new Set())
          return
        }
        const keys = (data ?? []).map((r: { permission_key: string }) => r.permission_key)
        setPermissions(new Set(keys))
      } catch (err) {
        console.error('usePermissions error:', err)
        setPermissions(new Set())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const has = (key: string) => permissions.has(key)
  const hasAny = (keys: string[]) => keys.some((k) => permissions.has(k))
  const hasAll = (keys: string[]) => keys.every((k) => permissions.has(k))

  return { permissions, loading, has, hasAny, hasAll }
}
