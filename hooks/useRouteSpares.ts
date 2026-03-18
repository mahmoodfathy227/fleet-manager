'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface RouteSpareRow {
  id: string
  spare_type: 'driver' | 'pa' | 'vehicle'
  driver_employee_id: number | null
  pa_employee_id: number | null
  vehicle_id: number | null
  starts_at: string
  ends_at: string | null
  reason: string | null
  is_active: boolean
  is_effectively_active: boolean
  created_at: string
  updated_at: string
}

export function useRouteSpares(routeId: number | null) {
  const [spares, setSpares] = useState<RouteSpareRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (routeId == null) {
      setSpares([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('get_route_spares', {
      p_route_id: routeId,
    })
    if (rpcError) {
      setError(rpcError.message)
      setSpares([])
    } else {
      setSpares((data ?? []) as RouteSpareRow[])
    }
    setLoading(false)
  }, [routeId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { spares, loading, error, refetch }
}

/** Get the effectively active spare for a given type (for badges). */
export function getEffectiveSpareForType(
  spares: RouteSpareRow[],
  type: 'driver' | 'pa' | 'vehicle'
): RouteSpareRow | undefined {
  return spares.find((s) => s.spare_type === type && s.is_effectively_active)
}

/** Format spare badge text: "SPARE (until 17:30)" or "SPARE (until 2026-03-05 09:00)" or "SPARE (until cleared)". */
export function formatSpareBadgeText(spare: RouteSpareRow): string {
  if (!spare.ends_at) return 'SPARE (until cleared)'
  const d = new Date(spare.ends_at)
  const today = new Date()
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `SPARE (until ${timePart})`
  const datePart = d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return `SPARE (until ${datePart} ${timePart})`
}
