'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { formatDate } from '@/lib/utils'
import {
  AGREEMENT_TYPES,
  TARGET_ROLE_OPTIONS,
  labelForAgreementType,
  labelForTargetRole,
} from '@/lib/agreements/constants'
import { ArrowLeft, Loader2, Plus, RefreshCw } from 'lucide-react'

const MarkdownPreview = dynamic(
  () => import('@/components/agreements/MarkdownPreview').then((m) => m.MarkdownPreview),
  {
    ssr: false,
    loading: () => <p className="text-slate-400 text-sm py-4">Loading preview…</p>,
  }
)
import { cn } from '@/lib/utils'

export type AgreementRow = {
  id: string
  title: string
  type: string
  target_roles: string[]
  is_active: boolean
  created_by: string | null
  created_at: string
}

type StatsRow = { total_targeted: number; total_accepted: number }

function canManageAgreements(permissions: Set<string>) {
  return permissions.has('users.manage') || permissions.has('roles.assign')
}

function typeBadgeClass(type: string) {
  switch (type) {
    case 'terms_of_service':
      return 'bg-amber-100 text-amber-900'
    case 'privacy_policy':
      return 'bg-violet-100 text-violet-900'
    case 'data_protection':
      return 'bg-rose-100 text-rose-900'
    case 'operational_notice':
      return 'bg-sky-100 text-sky-900'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

export function AgreementsClient() {
  const router = useRouter()
  const supabase = createClient()
  const { permissions, loading: permLoading } = usePermissions()
  const [rows, setRows] = useState<AgreementRow[]>([])
  const [statsById, setStatsById] = useState<Record<string, StatsRow>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'general' as string,
    targetRoles: ['parent', 'driver', 'passenger_assistant'] as string[],
  })
  const [previewTab, setPreviewTab] = useState<'write' | 'preview'>('write')

  const allowed = canManageAgreements(permissions)

  useEffect(() => {
    console.debug('[fleet] AgreementsClient: mount; Supabase list + stats via RPC get_agreement_stats')
    console.debug('[fleet] AgreementsClient: MarkdownPreview loaded client-only (dynamic import)')
  }, [])

  useEffect(() => {
    if (!permLoading && !allowed) {
      router.replace('/dashboard')
    }
  }, [permLoading, allowed, router])

  const loadStatsForRows = useCallback(
    async (list: AgreementRow[]) => {
      const entries = await Promise.all(
        list.map(async (r) => {
          const { data, error: err } = await supabase.rpc('get_agreement_stats', { p_agreement_id: r.id })
          if (err) {
            console.debug('[fleet] AgreementsClient: stats error', r.id, err.message)
            return [r.id, { total_targeted: 0, total_accepted: 0 }] as const
          }
          const row = Array.isArray(data) && data[0] ? (data[0] as StatsRow) : { total_targeted: 0, total_accepted: 0 }
          return [r.id, row] as const
        })
      )
      const next: Record<string, StatsRow> = {}
      entries.forEach(([id, s]) => {
        next[id] = s
      })
      setStatsById(next)
      console.debug('[fleet] AgreementsClient: stats loaded for', entries.length, 'agreements')
    },
    [supabase]
  )

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('agreements')
      .select('id, title, type, target_roles, is_active, created_by, created_at')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setRows([])
      setLoading(false)
      console.debug('[fleet] AgreementsClient: list error', fetchError.message)
      return
    }

    const list = (data ?? []) as AgreementRow[]
    setRows(list)
    setLoading(false)
    console.debug('[fleet] AgreementsClient: list rows', list.length)
    void loadStatsForRows(list)
  }, [supabase, loadStatsForRows])

  useEffect(() => {
    if (!permLoading && allowed) {
      void loadList()
    }
  }, [permLoading, allowed, loadList])

  const toggleRole = (value: string) => {
    setForm((f) => {
      const has = f.targetRoles.includes(value)
      const targetRoles = has ? f.targetRoles.filter((x) => x !== value) : [...f.targetRoles, value]
      return { ...f, targetRoles }
    })
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required.')
      return
    }
    if (form.targetRoles.length === 0) {
      setError('Select at least one target role.')
      return
    }

    setPublishing(true)
    const { data: agreementId, error: pubError } = await supabase.rpc('publish_agreement', {
      p_title: form.title.trim(),
      p_body: form.body.trim(),
      p_type: form.type,
      p_target_roles: form.targetRoles,
    })
    setPublishing(false)

    if (pubError) {
      setError(pubError.message)
      console.debug('[fleet] AgreementsClient: publish_agreement error', pubError.message)
      return
    }

    console.debug('[fleet] AgreementsClient: publish_agreement ok', agreementId)
    setPublishOpen(false)
    setForm({
      title: '',
      body: '',
      type: 'general',
      targetRoles: ['parent', 'driver', 'passenger_assistant'],
    })
    setPreviewTab('write')
    await loadList()
    if (typeof agreementId === 'string') {
      router.push(`/dashboard/agreements/${agreementId}`)
    }
  }

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Agreements</h1>
          <p className="text-sm text-slate-500 mt-1">
            Publish terms and policies for parents, drivers, and passenger assistants. Mobile app users must accept
            before continuing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void loadList()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button type="button" onClick={() => setPublishOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New agreement
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">All agreements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No agreements yet. Publish one to notify targeted app users.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Targets</th>
                    <th className="px-4 py-3 font-medium">Acceptance</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const s = statsById[r.id] ?? { total_targeted: 0, total_accepted: 0 }
                    const pct =
                      s.total_targeted > 0 ? Math.round((s.total_accepted / s.total_targeted) * 100) : 0
                    return (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-[220px] truncate">{r.title}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', typeBadgeClass(r.type))}>
                            {labelForAgreementType(r.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.target_roles.map((role) => (
                              <span
                                key={role}
                                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
                              >
                                {labelForTargetRole(role)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="text-xs text-slate-600 mb-1">
                            {s.total_accepted} / {s.total_targeted} ({pct}%)
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {r.is_active ? (
                            <span className="text-emerald-700 font-medium">Active</span>
                          ) : (
                            <span className="text-slate-500">Archived</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(r.created_at)}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/agreements/${r.id}`}
                            className="inline-flex items-center justify-center rounded-lg text-sm font-medium bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 px-3 py-1.5"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {publishOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto border-slate-200 shadow-xl my-8">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Publish agreement</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPublishOpen(false)}>
                Close
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePublish} className="space-y-4">
                <p className="text-sm text-slate-500">
                  Publishes to Supabase via <code className="text-xs bg-slate-100 px-1 rounded">publish_agreement</code> —
                  inserts notifications and triggers push (best-effort).
                </p>
                <div>
                  <Label htmlFor="agr-title">Title</Label>
                  <Input
                    id="agr-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Terms of Service – April 2026"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="agr-type">Type</Label>
                  <Select
                    id="agr-type"
                    className="mt-1 w-full border-slate-200"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    {AGREEMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Target roles</Label>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {TARGET_ROLE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.targetRoles.includes(opt.value)}
                          onChange={() => toggleRole(opt.value)}
                          className="rounded border-slate-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('write')}
                      className={cn(
                        'text-sm px-3 py-1 rounded-md',
                        previewTab === 'write' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('preview')}
                      className={cn(
                        'text-sm px-3 py-1 rounded-md',
                        previewTab === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      Preview
                    </button>
                  </div>
                  {previewTab === 'write' ? (
                    <textarea
                      id="agr-body"
                      value={form.body}
                      onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                      rows={14}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm"
                      placeholder="Markdown body…"
                    />
                  ) : (
                    <div className="rounded-md border border-slate-200 p-4 min-h-[280px] bg-white overflow-auto">
                      {form.body.trim() ? (
                        <MarkdownPreview markdown={form.body} />
                      ) : (
                        <p className="text-slate-400 text-sm">Nothing to preview.</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setPublishOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={publishing}>
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
