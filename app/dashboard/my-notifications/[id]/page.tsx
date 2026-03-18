'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getFunctionsUrl } from '@/lib/firebase-functions'

type NotificationDetail = {
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

export default function NotificationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const { permissions, loading: permLoading } = usePermissions()
  const [item, setItem] = useState<NotificationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const id = params?.id as string
  const hasInbox = permissions.has('notifications.inbox')

  useEffect(() => {
    if (!permLoading && !hasInbox) {
      router.replace('/dashboard')
      return
    }
  }, [permLoading, hasInbox, router])

  useEffect(() => {
    if (!hasInbox || !id) return

    const loadAndMarkRead = async () => {
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

        const baseUrl = getFunctionsUrl('/myInbox')
        const res = await fetch(`${baseUrl}?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error ?? 'Failed to load')
          setLoading(false)
          return
        }

        const found = (data.items ?? []).find((i: { notificationId: string }) => i.notificationId === id)
        if (found) {
          setItem(found)

          if (!found.readAt) {
            await fetch(getFunctionsUrl('/markRead'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ notificationId: id }),
            })
          }
        } else {
          setError('Notification not found')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }

    loadAndMarkRead()
  }, [hasInbox, id, supabase.auth])

  if (permLoading || !hasInbox) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/my-notifications"
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Notifications
        </Link>
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
      ) : item ? (
        <Card>
          <CardHeader>
            <CardTitle>{item.title}</CardTitle>
            <p className="text-sm text-slate-500">
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-slate max-w-none">
              <p className="whitespace-pre-wrap text-slate-700">{item.body}</p>
            </div>

            {item.deepLink && (
              <div>
                <p className="text-sm font-medium text-slate-600">Deep link</p>
                <p className="font-mono text-sm text-slate-500">{item.deepLink}</p>
              </div>
            )}

            {item.metadata && Object.keys(item.metadata).length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-600">Metadata</p>
                <pre className="mt-1 rounded bg-slate-100 p-3 text-xs overflow-x-auto">
                  {JSON.stringify(item.metadata, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
