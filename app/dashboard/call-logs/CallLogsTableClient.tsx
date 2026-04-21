'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'
import { Eye, Pencil, Phone, Trash2 } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'

const COLUMN_WIDTHS_STORAGE_KEY = 'fleet-dashboard:call-logs-column-widths'

const COL_KEYS = [
  'subject',
  'dateTime',
  'caller',
  'type',
  'relatedTo',
  'priority',
  'status',
  'actions',
] as const

type ColKey = (typeof COL_KEYS)[number]

const DEFAULT_COLUMN_WIDTHS: Record<ColKey, number> = {
  subject: 144,
  dateTime: 168,
  caller: 148,
  type: 104,
  relatedTo: 168,
  priority: 104,
  status: 128,
  actions: 124,
}

const COLUMN_LIMITS: Record<ColKey, { min: number; max: number }> = {
  subject: { min: 72, max: 560 },
  dateTime: { min: 120, max: 320 },
  caller: { min: 96, max: 340 },
  type: { min: 72, max: 220 },
  relatedTo: { min: 96, max: 420 },
  priority: { min: 80, max: 200 },
  status: { min: 96, max: 240 },
  actions: { min: 96, max: 220 },
}

function sanitizeStoredWidths(raw: unknown): Partial<Record<ColKey, number>> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: Partial<Record<ColKey, number>> = {}
  for (const key of COL_KEYS) {
    const v = o[key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      const { min, max } = COLUMN_LIMITS[key]
      out[key] = Math.min(max, Math.max(min, Math.round(v)))
    }
  }
  return out
}

function ResizableTh({
  colKey,
  width,
  children,
  className,
  onResize,
  onResizeEnd,
}: {
  colKey: ColKey
  width: number
  children: React.ReactNode
  className?: string
  onResize: (key: ColKey, next: number) => void
  onResizeEnd: () => void
}) {
  const limits = COLUMN_LIMITS[colKey]

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = width
    const { min, max } = limits

    const onMove = (ev: MouseEvent) => {
      const next = Math.min(max, Math.max(min, startW + ev.clientX - startX))
      onResize(colKey, next)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      onResizeEnd()
      console.debug('[CallLogsTableClient] column resize finished', colKey)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <TableHead
      className={cn('relative overflow-hidden', className)}
      style={{ width, minWidth: limits.min, maxWidth: limits.max }}
    >
      <div className="truncate pr-3">{children}</div>
      <div
        className="absolute right-0 top-0 z-10 h-full w-2.5 cursor-col-resize border-r border-transparent hover:border-slate-300 hover:bg-slate-200/50 active:bg-primary/20"
        onMouseDown={onMouseDown}
        title="Drag to resize column"
        aria-hidden
      />
    </TableHead>
  )
}

/** Newest-created first (matches list default). Falls back to call_date, then id. */
function sortCallLogsNewestFirst<
  T extends { id?: number; created_at?: string | null; call_date?: string | null },
>(rows: T[]): T[] {
  const key = (row: T) => {
    if (row.created_at) return new Date(row.created_at).getTime()
    if (row.call_date) return new Date(row.call_date).getTime()
    return 0
  }
  return [...rows].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    if (kb !== ka) return kb - ka
    return (b.id ?? 0) - (a.id ?? 0)
  })
}

const SELECT_WITH_RELATIONS = `
  *,
  passengers(full_name),
  employees(full_name),
  routes(route_number)
`

export function CallLogsTableClient() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const createdHint = searchParams?.get('created')
  const [callLogs, setCallLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; subject: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const colWidthsRef = useRef<Record<ColKey, number>>({ ...DEFAULT_COLUMN_WIDTHS })
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(() => ({ ...DEFAULT_COLUMN_WIDTHS }))

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY)
      if (raw) {
        const merged = {
          ...DEFAULT_COLUMN_WIDTHS,
          ...sanitizeStoredWidths(JSON.parse(raw)),
        }
        setColWidths(merged)
        colWidthsRef.current = merged
        console.debug('[CallLogsTableClient] restored column widths from localStorage')
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    colWidthsRef.current = colWidths
  }, [colWidths])

  const handleColumnResize = useCallback((key: ColKey, next: number) => {
    setColWidths((prev) => {
      const updated = { ...prev, [key]: next }
      colWidthsRef.current = updated
      return updated
    })
  }, [])

  const persistColumnWidths = useCallback(() => {
    try {
      localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(colWidthsRef.current))
      console.debug('[CallLogsTableClient] column widths saved', colWidthsRef.current)
    } catch {
      /* ignore */
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()
    console.debug('[CallLogsTableClient] load start', {
      createdHint,
      hasSession: !!session,
    })

    const { data, error } = await supabase
      .from('call_logs')
      .select(SELECT_WITH_RELATIONS)
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })

    if (error) {
      console.error('[CallLogsTableClient] select with relations failed, retrying *', error)
      const fallback = await supabase
        .from('call_logs')
        .select('*')
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
      if (fallback.error) {
        setFetchError(fallback.error.message || 'Could not load call logs')
        setCallLogs([])
        console.error('[CallLogsTableClient] fallback failed', fallback.error)
      } else {
        const sorted = sortCallLogsNewestFirst(fallback.data || [])
        setCallLogs(sorted)
        setFetchError(null)
        console.debug('[CallLogsTableClient] loaded (fallback *) by created_at newest-first', {
          count: sorted.length,
          createdHint,
        })
      }
    } else {
      const sorted = sortCallLogsNewestFirst(data || [])
      setCallLogs(sorted)
      console.debug('[CallLogsTableClient] loaded by created_at newest-first', { count: sorted.length, createdHint })
    }

    setLoading(false)
  }, [createdHint, supabase])

  useEffect(() => {
    console.debug('[CallLogsTableClient] table columns: Subject first, then Date/Time, Caller, Type, …')
    console.debug('[CallLogsTableClient] instruction text updated: sort + resize help')
  }, [])

  useEffect(() => {
    void load()
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        console.debug('[CallLogsTableClient] auth event -> reload', { event })
        void load()
      }
    })
    return () => {
      authSub.subscription.unsubscribe()
    }
  }, [load, supabase])

  const confirmDeleteRow = useCallback(async () => {
    if (!pendingDelete) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const { error: delErr } = await supabase.from('call_logs').delete().eq('id', pendingDelete.id)
      if (delErr) throw delErr

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'call_logs',
          record_id: pendingDelete.id,
          action: 'DELETE',
        }),
      })

      console.debug('[CallLogsTableClient] deleted call log from list', pendingDelete.id)
      setPendingDelete(null)
      await load()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not delete'
      setDeleteError(message)
      console.error('[CallLogsTableClient] delete failed', err)
    } finally {
      setDeleteLoading(false)
    }
  }, [pendingDelete, supabase, load])

  useEffect(() => {
    if (loading || callLogs.length === 0) return
    const raw = createdHint
    if (!raw) return
    const id = parseInt(raw, 10)
    if (Number.isNaN(id)) return
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-call-log-id="${id}"]`)
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        console.debug('[CallLogsTableClient] scrolled to ?created= row', id)
      }
    })
  }, [loading, callLogs, createdHint])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-4 py-12 text-center text-sm text-slate-500">
        Loading call logs…
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-800">
        <p className="font-medium">Could not load call logs</p>
        <p className="mt-1 text-red-700">{fetchError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pendingDelete && (
        <ConfirmDeleteCard
          entityName={`Call log: ${pendingDelete.subject}`}
          items={[
            'The call log record',
            'All linked passenger, driver, and route references',
            'Subject, notes, and follow-up data',
          ]}
          confirmLabel="Yes, Delete Call Log"
          onConfirm={confirmDeleteRow}
          onCancel={() => {
            setPendingDelete(null)
            setDeleteError(null)
          }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <p className="border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs text-slate-500">
        Call logs are sorted from <span className="font-medium text-slate-600">newest to oldest</span> by creation time.
        Drag the right edge of any column to resize it; your sizes are saved in this browser.
      </p>
      <Table className="table-fixed w-full min-w-[900px]">
        <TableHeader>
          <TableRow>
            <ResizableTh
              colKey="subject"
              width={colWidths.subject}
              onResize={handleColumnResize}
              onResizeEnd={persistColumnWidths}
            >
              Subject
            </ResizableTh>
            <ResizableTh
              colKey="dateTime"
              width={colWidths.dateTime}
              onResize={handleColumnResize}
              onResizeEnd={persistColumnWidths}
            >
              Date/Time
            </ResizableTh>
            <ResizableTh
              colKey="caller"
              width={colWidths.caller}
              onResize={handleColumnResize}
              onResizeEnd={persistColumnWidths}
            >
              Caller
            </ResizableTh>
            <ResizableTh
              colKey="type"
              width={colWidths.type}
              onResize={handleColumnResize}
              onResizeEnd={persistColumnWidths}
            >
              Type
            </ResizableTh>
            <ResizableTh
              colKey="relatedTo"
              width={colWidths.relatedTo}
              onResize={handleColumnResize}
              onResizeEnd={persistColumnWidths}
            >
              Related To
            </ResizableTh>
            <ResizableTh
              colKey="priority"
              width={colWidths.priority}
              onResize={handleColumnResize}
              onResizeEnd={persistColumnWidths}
            >
              Priority
            </ResizableTh>
            <ResizableTh
              colKey="status"
              width={colWidths.status}
              onResize={handleColumnResize}
              onResizeEnd={persistColumnWidths}
            >
              Status
            </ResizableTh>
            <ResizableTh
              colKey="actions"
              width={colWidths.actions}
              onResize={handleColumnResize}
              onResizeEnd={persistColumnWidths}
            >
              Actions
            </ResizableTh>
          </TableRow>
        </TableHeader>
        <TableBody>
          {callLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12">
                <Phone className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No call logs found</p>
                <p className="text-sm text-slate-400">Log your first call to get started</p>
              </TableCell>
            </TableRow>
          ) : (
            callLogs.map((log: any) => (
              <TableRow key={log.id} data-call-log-id={log.id} className="hover:bg-slate-50">
                <TableCell
                  className="align-top overflow-hidden"
                  style={{ width: colWidths.subject, maxWidth: colWidths.subject }}
                >
                  <div className="truncate text-sm font-semibold text-slate-800" title={log.subject}>
                    {log.subject}
                  </div>
                  {log.notes && (
                    <div className="text-xs text-slate-400 truncate mt-0.5" title={log.notes}>
                      {log.notes}
                    </div>
                  )}
                </TableCell>
                <TableCell
                  className="overflow-hidden"
                  style={{ width: colWidths.dateTime, maxWidth: colWidths.dateTime }}
                >
                  <div className="text-sm truncate" title={formatDateTime(log.call_date)}>
                    <div className="font-semibold text-slate-800">{formatDateTime(log.call_date)}</div>
                  </div>
                </TableCell>
                <TableCell
                  className="overflow-hidden"
                  style={{ width: colWidths.caller, maxWidth: colWidths.caller }}
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800" title={log.caller_name || undefined}>
                      {log.caller_name || 'Unknown'}
                    </div>
                    <div className="truncate text-xs text-slate-500" title={log.caller_phone || undefined}>
                      {log.caller_phone || 'No phone'}
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className="overflow-hidden"
                  style={{ width: colWidths.type, maxWidth: colWidths.type }}
                >
                  <span className="inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-700">
                    {log.call_type || 'N/A'}
                  </span>
                </TableCell>
                <TableCell
                  className="overflow-hidden align-top"
                  style={{ width: colWidths.relatedTo, maxWidth: colWidths.relatedTo }}
                >
                  <div className="text-xs space-y-1 min-w-0">
                    {log.passengers && log.related_passenger_id != null && (
                      <div>
                        <span className="text-slate-400">Passenger: </span>
                        <Link
                          href={`/dashboard/passengers/${log.related_passenger_id}`}
                          className="text-primary hover:underline"
                        >
                          {(log.passengers as { full_name?: string })?.full_name ?? '—'}
                        </Link>
                      </div>
                    )}
                    {log.employees && log.related_employee_id != null && (
                      <div>
                        <span className="text-slate-400">Employee: </span>
                        <span className="font-medium text-slate-700">
                          {(log.employees as { full_name?: string })?.full_name ?? '—'}
                        </span>
                      </div>
                    )}
                    {log.routes && log.related_route_id != null && (
                      <div>
                        <span className="text-slate-400">Route: </span>
                        <span className="font-medium text-slate-700">
                          {(log.routes as { route_number?: string })?.route_number ?? '—'}
                        </span>
                      </div>
                    )}
                    {!log.passengers && !log.employees && !log.routes && (
                      <span className="text-slate-300">None</span>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className="overflow-hidden"
                  style={{ width: colWidths.priority, maxWidth: colWidths.priority }}
                >
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      log.priority === 'Urgent'
                        ? 'bg-rose-100 text-rose-700'
                        : log.priority === 'High'
                          ? 'bg-orange-100 text-orange-700'
                          : log.priority === 'Medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {log.priority || 'Low'}
                  </span>
                </TableCell>
                <TableCell
                  className="overflow-hidden align-top"
                  style={{ width: colWidths.status, maxWidth: colWidths.status }}
                >
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      log.status === 'Resolved' || log.status === 'Closed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : log.status === 'In Progress'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {log.status || 'Open'}
                  </span>
                  {log.action_required && (
                    <div className="mt-1">
                      <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                        Action Required
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell
                  className="overflow-hidden"
                  style={{ width: colWidths.actions, maxWidth: colWidths.actions }}
                >
                  <div className="flex items-center gap-1">
                    <Link href={`/dashboard/call-logs/${log.id}`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/call-logs/${log.id}/edit`} prefetch={true}>
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-primary hover:bg-primary/10">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                      title="Delete call log"
                      onClick={() => {
                        console.debug('[CallLogsTableClient] delete requested', log.id)
                        setDeleteError(null)
                        setPendingDelete({
                          id: log.id,
                          subject: (log.subject as string) || `Call log #${log.id}`,
                        })
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
