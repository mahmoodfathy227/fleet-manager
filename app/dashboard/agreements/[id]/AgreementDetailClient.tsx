'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import {
  labelForAgreementType,
  labelForTargetRole,
} from '@/lib/agreements/constants'
import type { AgreementRow } from '../AgreementsClient'

const MarkdownPreview = dynamic(
  () => import('@/components/agreements/MarkdownPreview').then((m) => m.MarkdownPreview),
  {
    ssr: false,
    loading: () => <p className="text-slate-400 text-sm py-4">Loading content…</p>,
  }
)

type AgreementDetail = AgreementRow & { body: string }
import { ArrowLeft, Archive, CopyPlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatsRow = { total_targeted: number; total_accepted: number }

function canManageAgreements(permissions: Set<string>) {
  return permissions.has('users.manage') || permissions.has('roles.assign')
}

export function AgreementDetailClient({ agreementId }: { agreementId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const { permissions, loading: permLoading } = usePermissions()
  const [row, setRow] = useState<AgreementDetail | null>(null)
  const [stats, setStats] = useState<StatsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [republishing, setRepublishing] = useState(false)

  const allowed = canManageAgreements(permissions)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('agreements')
      .select('id, title, body, type, target_roles, is_active, created_by, created_at')
      .eq('id', agreementId)
      .single()

    if (fetchError || !data) {
      setError(fetchError?.message ?? 'Agreement not found')
      setRow(null)
      setStats(null)
      setLoading(false)
      console.debug('[fleet] AgreementDetailClient: load error', fetchError?.message)
      return
    }

    setRow(data as AgreementDetail)

    const { data: statsData, error: statsError } = await supabase.rpc('get_agreement_stats', {
      p_agreement_id: agreementId,
    })
    if (statsError) {
      console.debug('[fleet] AgreementDetailClient: stats error', statsError.message)
      setStats({ total_targeted: 0, total_accepted: 0 })
    } else {
      const s = Array.isArray(statsData) && statsData[0] ? (statsData[0] as StatsRow) : { total_targeted: 0, total_accepted: 0 }
      setStats(s)
    }
    setLoading(false)
    console.debug('[fleet] AgreementDetailClient: loaded', agreementId)
  }, [agreementId, supabase])

  useEffect(() => {
    console.debug('[fleet] AgreementDetailClient: mount', agreementId)
    console.debug('[fleet] AgreementDetailClient: MarkdownPreview client-only (dynamic import)')
  }, [agreementId])

  useEffect(() => {
    if (!permLoading && !allowed) {
      router.replace('/dashboard')
    }
  }, [permLoading, allowed, router])

  useEffect(() => {
    if (permLoading || !allowed) return
    void load()
  }, [permLoading, allowed, load])

  const handleArchive = async () => {
    if (!row?.is_active) return
    if (!window.confirm('Archive this agreement? Users who have not accepted will no longer see it. Acceptances are kept for audit.')) {
      return
    }
    setArchiving(true)
    setError(null)
    const { error: archError } = await supabase.rpc('archive_agreement', { p_agreement_id: agreementId })
    setArchiving(false)
    if (archError) {
      setError(archError.message)
      console.debug('[fleet] AgreementDetailClient: archive error', archError.message)
      return
    }
    console.debug('[fleet] AgreementDetailClient: archived', agreementId)
    await load()
  }

  const handleRepublish = async () => {
    if (!row) return
    if (
      !window.confirm(
        'Create a new published version from this content? The current agreement will be archived and a new one will be sent to targeted users.'
      )
    ) {
      return
    }
    setRepublishing(true)
    setError(null)

    if (row.is_active) {
      const { error: archError } = await supabase.rpc('archive_agreement', { p_agreement_id: agreementId })
      if (archError) {
        setRepublishing(false)
        setError(archError.message)
        console.debug('[fleet] AgreementDetailClient: republish archive error', archError.message)
        return
      }
    }

    const bodyText = row.body
    const { data: newId, error: pubError } = await supabase.rpc('publish_agreement', {
      p_title: row.title,
      p_body: bodyText,
      p_type: row.type,
      p_target_roles: row.target_roles,
    })
    setRepublishing(false)
    if (pubError) {
      setError(pubError.message)
      console.debug('[fleet] AgreementDetailClient: republish error', pubError.message)
      return
    }
    console.debug('[fleet] AgreementDetailClient: republished →', newId)
    if (typeof newId === 'string') {
      router.replace(`/dashboard/agreements/${newId}`)
      router.refresh()
    } else {
      router.push('/dashboard/agreements')
    }
  }

  if (permLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error && !row) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/agreements" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" />
          Back to agreements
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    )
  }

  if (!row) return null

  const pct =
    stats && stats.total_targeted > 0
      ? Math.round((stats.total_accepted / stats.total_targeted) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/agreements"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            All agreements
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{row.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              )}
            >
              {row.is_active ? 'Active' : 'Archived'}
            </span>
            <span className="text-slate-400">·</span>
            <span>{labelForAgreementType(row.type)}</span>
            <span className="text-slate-400">·</span>
            <span>Created {formatDate(row.created_at)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {row.target_roles.map((role) => (
              <span key={role} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {labelForTargetRole(role)}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleRepublish()}
            disabled={republishing || archiving}
          >
            {republishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4 mr-2" />}
            Re-publish as new version
          </Button>
          {row.is_active && (
            <Button type="button" variant="outline" onClick={() => void handleArchive()} disabled={archiving || republishing}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
              Archive
            </Button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Acceptance</CardTitle>
        </CardHeader>
        <CardContent>
          {stats ? (
            <>
              <p className="text-sm text-slate-600 mb-2">
                {stats.total_accepted} of {stats.total_targeted} targeted users ({pct}%) — denominator is current users with
                a matching role and linked auth account.
              </p>
              <div className="h-3 w-full max-w-md rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm">No stats</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Content (markdown)</CardTitle>
        </CardHeader>
        <CardContent className="border-t border-slate-100 pt-4">
          <MarkdownPreview markdown={row.body} />
        </CardContent>
      </Card>
    </div>
  )
}
