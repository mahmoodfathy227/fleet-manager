'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Send, Loader2, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { getFunctionsUrl } from '@/lib/firebase-functions'

type RouteOption = { value: string; label: string }
type RecipientOption = { value: string; label: string }

const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'single_user', label: 'Individual (single user)' },
  { value: 'route_parents', label: 'Route Parents' },
  { value: 'route_crew', label: 'Route Crew (driver + PA)' },
]

export default function AdminSendNotificationPage() {
  const router = useRouter()
  const supabase = createClient()
  const { permissions, loading: permLoading } = usePermissions()
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [recipients, setRecipients] = useState<RecipientOption[]>([])
  const [recipientSearch, setRecipientSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    notificationId: string
    recipientCount: number
    tokenCount: number
    sentCount: number
    failedCount: number
  } | null>(null)

  const [form, setForm] = useState({
    audienceType: 'single_user',
    targetUserId: '',
    routeId: '',
    title: '',
    body: '',
    deepLink: '',
    metadataJson: '',
  })

  const hasNotifyPerm =
    permissions.has('notifications.send.single') ||
    permissions.has('notifications.send.route_parents') ||
    permissions.has('notifications.send.route_crew')

  useEffect(() => {
    if (!permLoading && !hasNotifyPerm) {
      router.replace('/dashboard')
      return
    }
  }, [permLoading, hasNotifyPerm, router])

  useEffect(() => {
    const loadRoutes = async () => {
      const { data, error: err } = await supabase
        .from('routes')
        .select('id, route_number, school_id')
        .order('id')
      if (err) {
        setError('Failed to load routes')
        return
      }
      const opts: RouteOption[] = (data ?? []).map((r: { id: number; route_number: string | null; school_id: number | null }) => ({
        value: String(r.id),
        label: `${r.route_number ?? r.id} (School ${r.school_id ?? '?'})`,
      }))
      setRoutes(opts)
    }
    loadRoutes()
  }, [supabase])

  useEffect(() => {
    if (form.audienceType !== 'single_user') return
    const t = setTimeout(async () => {
      const search = recipientSearch.trim()
      if (search.length < 2) {
        setRecipients([])
        return
      }
      const { data, error: err } = await supabase.rpc('search_notification_recipients', {
        p_search: search,
      })
      if (err) {
        setRecipients([])
        return
      }
      const opts: RecipientOption[] = (data ?? []).map(
        (r: { user_id: string; email: string | null; display_name: string | null }) => ({
          value: r.user_id,
          label: `${r.display_name ?? 'Unknown'} (${r.email ?? ''})`,
        })
      )
      setRecipients(opts)
    }, 300)
    return () => clearTimeout(t)
  }, [recipientSearch, form.audienceType, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required')
      return
    }

    if (form.audienceType === 'single_user' && !form.targetUserId) {
      setError('Please select a recipient for Individual audience')
      return
    }

    if (
      (form.audienceType === 'route_parents' || form.audienceType === 'route_crew') &&
      !form.routeId
    ) {
      setError('Please select a route')
      return
    }

    let metadata: Record<string, unknown> | undefined
    if (form.metadataJson.trim()) {
      try {
        metadata = JSON.parse(form.metadataJson) as Record<string, unknown>
      } catch {
        setError('Invalid JSON in metadata')
        return
      }
    }

    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setError('Not authenticated')
        setSending(false)
        return
      }

      const payload: Record<string, unknown> = {
        audienceType: form.audienceType,
        title: form.title.trim(),
        body: form.body.trim(),
        deepLink: form.deepLink.trim() || undefined,
        metadata,
      }
      if (form.audienceType === 'single_user') {
        payload.targetUserId = form.targetUserId
      } else {
        payload.routeId = parseInt(form.routeId, 10)
      }

      const res = await fetch(getFunctionsUrl('/sendNotification'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send notification')
        setSending(false)
        return
      }

      setResult(data)
      setForm((f) => ({ ...f, title: '', body: '', deepLink: '', metadataJson: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  if (permLoading || !hasNotifyPerm) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900">Send Push Notification</h1>

      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="audienceType">Audience</Label>
              <SearchableSelect
                id="audienceType"
                options={AUDIENCE_OPTIONS}
                value={form.audienceType}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    audienceType: v,
                    targetUserId: '',
                    routeId: '',
                  }))
                }
                placeholder="Select audience type"
              />
            </div>

            {form.audienceType === 'single_user' && (
              <div>
                <Label htmlFor="recipient">Recipient</Label>
                <div className="space-y-2">
                  <Input
                    id="recipientSearch"
                    placeholder="Search by name or email..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                  />
                  <SearchableSelect
                    id="recipient"
                    options={recipients}
                    value={form.targetUserId}
                    onChange={(v) => setForm((f) => ({ ...f, targetUserId: v }))}
                    placeholder="Select or paste UUID"
                    emptyLabel="Search above to find users"
                  />
                </div>
              </div>
            )}

            {(form.audienceType === 'route_parents' || form.audienceType === 'route_crew') && (
              <div>
                <Label htmlFor="routeId">Route</Label>
                <SearchableSelect
                  id="routeId"
                  options={routes}
                  value={form.routeId}
                  onChange={(v) => setForm((f) => ({ ...f, routeId: v }))}
                  placeholder="Select route"
                  emptyLabel="No routes"
                />
              </div>
            )}

            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Notification title"
                required
              />
            </div>

            <div>
              <Label htmlFor="body">Body *</Label>
              <textarea
                id="body"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Notification message"
                required
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <Label htmlFor="deepLink">Deep Link (optional)</Label>
              <Input
                id="deepLink"
                value={form.deepLink}
                onChange={(e) => setForm((f) => ({ ...f, deepLink: e.target.value }))}
                placeholder="/dashboard/routes/123"
              />
            </div>

            <div>
              <Label htmlFor="metadata">Metadata JSON (optional)</Label>
              <textarea
                id="metadata"
                value={form.metadataJson}
                onChange={(e) => setForm((f) => ({ ...f, metadataJson: e.target.value }))}
                placeholder='{"key": "value"}'
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {result && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Sent to {result.recipientCount} recipient(s), {result.sentCount} FCM delivered
                {result.failedCount > 0 && `, ${result.failedCount} failed`}
              </div>
            )}

            <Button type="submit" disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Notification
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
