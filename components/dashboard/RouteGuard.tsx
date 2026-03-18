'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { canAccessRoute } from '@/lib/permissions'

/**
 * Redirects to /dashboard if user lacks permission for current route.
 * RLS remains the real enforcement; this prevents "no access" UI flicker.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { permissions, loading } = usePermissions()

  useEffect(() => {
    if (loading) return
    if (!pathname?.startsWith('/dashboard')) return
    if (pathname === '/dashboard' || pathname === '/dashboard/') return
    if (canAccessRoute(pathname, permissions)) return
    router.replace('/dashboard')
  }, [pathname, permissions, loading, router])

  return <>{children}</>
}
