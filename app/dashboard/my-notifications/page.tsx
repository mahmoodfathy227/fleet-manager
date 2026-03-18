'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Bell, Loader2, ChevronRight, Mail } from 'lucide-react'
import Link from 'next/link'
import { getFunctionsUrl } from '@/lib/firebase-functions'

type InboxItem = {
  notificationId: string
  title: string
  body: string
  createdAt: string
  readAt: string | null
  deepLink: string | null
  metadata: Record<string, unknown> | null
  audienceType: string
  routeId: number | null
}

export default function MyNotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { permissions, loading: permLoading } = usePermissions()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasInbox = permissions.has('notifications.inbox')

  useEffect(() => {
    if (!permLoading && !hasInbox) {
      router.replace('/dashboard')
      return
    }
  }, [permLoading, hasInbox, router])

  useEffect(() => {
    if (!hasInbox) return

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          setError('Not authenticated')
          setLoading(false)
          return
        }

        const res = await fetch(getFunctionsUrl('/myInbox?limit=50'), {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error ?? 'Failed to load notifications')
          setItems([])
          setLoading(false)
          return
        }

        setItems(data.items ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
        setItems([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [hasInbox, supabase.auth])

  if (permLoading || !hasInbox) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  const unreadCount = items.filter((i) => !i.readAt).length

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Notifications</h1>
        <p className="mt-2 text-sm text-gray-600">
          Push notifications and inbox
          {unreadCount > 0 && (
            <span className="ml-2 text-primary font-medium">{unreadCount} unread</span>
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-slate-600">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.notificationId}
              href={`/dashboard/my-notifications/${item.notificationId}`}
              className="block"
            >
              <Card
                className={`transition-colors hover:bg-slate-50 ${
                  !item.readAt ? 'border-l-4 border-l-primary' : ''
                }`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.title}</span>
                        {!item.readAt && (
                          <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.body}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : ''}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
