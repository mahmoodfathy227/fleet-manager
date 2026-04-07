'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Send, Loader2, ArrowLeft, CheckCircle, AlertCircle, Eye, Pencil } from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────

type RouteOption = { value: string; label: string }
type RecipientOption = { value: string; label: string }
type RecipientRaw = {
  user_id: string
  email: string | null
  display_name: string | null
  phone_number: string | null
  source: string
}

// ── Audience options ───────────────────────────────────────────────────────

const AUDIENCE_OPTIONS: { value: string; label: string; description: string }[] = [
  {
    value: 'single_user',
    label: 'One person',
    description: 'A single parent, driver, or passenger assistant',
  },
  {
    value: 'all_parents',
    label: 'All parents',
    description: 'Every parent registered in the app',
  },
  {
    value: 'all_drivers',
    label: 'All drivers',
    description: 'Every driver registered in the app',
  },
  {
    value: 'all_passenger_assistants',
    label: 'All passenger assistants',
    description: 'Every passenger assistant registered in the app',
  },
  {
    value: 'route_parents',
    label: 'Parents on a route',
    description: 'Parents of passengers assigned to a specific route',
  },
  {
    value: 'route_crew',
    label: 'Crew on a route',
    description: 'The driver and passenger assistant assigned to a specific route',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function buildRecipientLabel(r: RecipientRaw): string {
  const parts = [r.phone_number, r.email].filter(Boolean).join(' \u2014 ')
  return parts ? `${r.display_name ?? 'Unknown'} (${parts})` : (r.display_name ?? 'Unknown')
}

const needsRoute = (t: string) => t === 'route_parents' || t === 'route_crew'
const needsUser  = (t: string) => t === 'single_user'

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminSendNotificationPage() {
  const router = useRouter()
  const supabase = createClient()
  const { permissions, loading: permLoading } = usePermissions()

  const [routes, setRoutes]               = useState<RouteOption[]>([])
  const [recipients, setRecipients]       = useState<RecipientOption[]>([])
  const [sending, setSending]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [result, setResult]               = useState<{ recipient_count: number } | null>(null)
  const [previewMode, setPreviewMode]     = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [form, setForm] = useState({
    audienceType: 'single_user',
    targetUserId: '',
    routeId: '',
    title: '',
    bodyMd: '',
  })

  const hasNotifyPerm =
    permissions.has('notifications.send.single') ||
    permissions.has('notifications.send.route_parents') ||
    permissions.has('notifications.send.route_crew')

  // Redirect if no permission
  useEffect(() => {
    if (!permLoading && !hasNotifyPerm) {
      router.replace('/dashboard')
    }
  }, [permLoading, hasNotifyPerm, router])

  // Load routes (for route-based audiences)
  useEffect(() => {
    supabase
      .from('routes')
      .select('id, route_number, school_id')
      .order('id')
      .then(({ data, error: err }) => {
        if (err) { setError('Failed to load routes'); return }
        setRoutes(
          (data ?? []).map((r: { id: number; route_number: string | null; school_id: number | null }) => ({
            value: String(r.id),
            label: `${r.route_number ?? r.id} (School ${r.school_id ?? '?'})`,
          }))
        )
      })
  }, [supabase])

  // Debounced recipient search — triggered by SearchableSelect's internal search box
  const recipientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleRecipientSearch = useCallback((search: string) => {
    if (recipientDebounceRef.current) clearTimeout(recipientDebounceRef.current)
    if (search.trim().length < 1) { setRecipients([]); return }
    recipientDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase.rpc('search_notification_recipients', { p_search: search.trim() })
      setRecipients(
        (data ?? []).map((r: RecipientRaw) => ({
          value: r.user_id,
          label: buildRecipientLabel(r),
        }))
      )
    }, 300)
  }, [supabase])

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!form.title.trim() || !form.bodyMd.trim()) {
      setError('Title and message body are required')
      return
    }
    if (needsUser(form.audienceType) && !form.targetUserId) {
      setError('Please select a recipient')
      return
    }
    if (needsRoute(form.audienceType) && !form.routeId) {
      setError('Please select a route')
      return
    }

    setSending(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('send_admin_broadcast', {
        p_audience_type:  form.audienceType,
        p_title:          form.title.trim(),
        p_body_md:        form.bodyMd.trim(),
        p_target_user_id: needsUser(form.audienceType)  ? form.targetUserId          : null,
        p_route_id:       needsRoute(form.audienceType) ? parseInt(form.routeId, 10) : null,
      })

      if (rpcErr) { setError(rpcErr.message); return }

      setResult(data as { recipient_count: number })
      setForm((f) => ({ ...f, title: '', bodyMd: '', targetUserId: '' }))
      setRecipients([])
      setPreviewMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  // ── Loading guard ────────────────────────────────────────────────────────

  if (permLoading || !hasNotifyPerm) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const audienceSelectOptions = AUDIENCE_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }))
  const selectedAudience = AUDIENCE_OPTIONS.find((o) => o.value === form.audienceType)

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Send Message to App Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your message will be delivered as a push notification to recipients&apos; phones via the County Cars app.
        </p>
      </div>

      {/* ── Card 1: Audience ── */}
      <Card>
        <CardHeader>
          <CardTitle>Who receives this?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Audience type */}
          <div>
            <Label htmlFor="audienceType">Send to</Label>
            <SearchableSelect
              id="audienceType"
              options={audienceSelectOptions}
              value={form.audienceType}
              onChange={(v) =>
                setForm((f) => ({ ...f, audienceType: v, targetUserId: '', routeId: '' }))
              }
              placeholder="Choose who gets this message"
            />
            {selectedAudience && (
              <p className="mt-1 text-xs text-slate-500">{selectedAudience.description}</p>
            )}
          </div>

          {/* Single user: search + select (one combined element) */}
          {needsUser(form.audienceType) && (
            <div>
              <Label htmlFor="recipient">Recipient</Label>
              <SearchableSelect
                id="recipient"
                options={recipients}
                value={form.targetUserId}
                onChange={(v) => setForm((f) => ({ ...f, targetUserId: v }))}
                onSearchChange={handleRecipientSearch}
                placeholder="Search by name, phone, or email…"
                emptyLabel="Type to search by name, phone, or email"
              />
            </div>
          )}

          {/* Route-based: route selector */}
          {needsRoute(form.audienceType) && (
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
        </CardContent>
      </Card>

      {/* ── Card 2: Message ── */}
      <Card>
        <CardHeader>
          <CardTitle>Your message</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Important update about tomorrow's routes"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Appears on the lock screen. Keep it short and clear.
              </p>
            </div>

            {/* Body — write / preview tabs */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Body</Label>
                <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => { setPreviewMode(false); setTimeout(() => textareaRef.current?.focus(), 0) }}
                    className={`flex items-center gap-1 px-3 py-1 transition-colors ${
                      !previewMode
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Pencil className="h-3 w-3" />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(true)}
                    className={`flex items-center gap-1 px-3 py-1 transition-colors ${
                      previewMode
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                </div>
              </div>

              {!previewMode ? (
                <textarea
                  ref={textareaRef}
                  id="bodyMd"
                  value={form.bodyMd}
                  onChange={(e) => setForm((f) => ({ ...f, bodyMd: e.target.value }))}
                  placeholder="Write your message here…"
                  required
                  rows={7}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y font-mono"
                />
              ) : (
                <div
                  className={`min-h-[11rem] rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800
                    [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2
                    [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1
                    [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1
                    [&_p]:mb-2
                    [&_strong]:font-semibold
                    [&_em]:italic
                    [&_a]:text-blue-600 [&_a]:underline
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
                    [&_li]:mb-0.5
                    [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600
                    [&_code]:bg-slate-200 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                    [&_hr]:border-slate-300 [&_hr]:my-3`}
                >
                  {form.bodyMd.trim() ? (
                    <ReactMarkdown>{form.bodyMd}</ReactMarkdown>
                  ) : (
                    <span className="text-slate-400 italic">Nothing to preview yet</span>
                  )}
                </div>
              )}

              <p className="mt-1 text-xs text-slate-500">
                Markdown supported: <code className="bg-slate-100 px-1 rounded">**bold**</code>{' '}
                <code className="bg-slate-100 px-1 rounded">*italic*</code>{' '}
                <code className="bg-slate-100 px-1 rounded">[link text](https://…)</code>{' '}
                <code className="bg-slate-100 px-1 rounded">- bullet point</code>
              </p>
            </div>

            {/* Errors / success */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {result && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Message queued for {result.recipient_count} recipient{result.recipient_count !== 1 ? 's' : ''}.
                Push delivery is in progress.
              </div>
            )}

            <Button type="submit" disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}