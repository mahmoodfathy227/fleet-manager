'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { emitComplianceNotificationsChanged } from '@/lib/complianceNotificationsEvents'
import { Bell, X } from 'lucide-react'

const COMPLIANCE_PATH = '/dashboard/compliance'
const TOAST_MS = 8000
const MAX_TOASTS = 5

type ToastItem = {
  key: string
  recordId: number
  /** User-friendly `notification_type` label (underscores → words) */
  notificationTypeLine: string
  /** `entity_type` + `certificate_name` when present */
  entityAndCertLine: string
  /** Resolved person name, or null */
  personLine: string | null
}

function parseDetails(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  return null
}

/** Readable title from DB `notification_type` (e.g. certificate_expiry → Certificate Expiry). */
function humanizeNotificationType(row: Record<string, unknown>): string {
  const v = row.notification_type
  if (typeof v !== 'string' || !v.trim()) return 'Notification'
  return v
    .trim()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Line 2: entity type (label) and certificate name if it exists. */
function buildEntityAndCertificateLine(row: Record<string, unknown>): string {
  const ntype = typeof row.notification_type === 'string' ? row.notification_type : ''
  const details = parseDetails(row.details)
  if (ntype === 'trip_cancellation' && details) {
    const rn = details.route_number
    const r = details.reason
    const parts = [
      typeof rn === 'string' && rn.trim() ? rn.trim() : '',
      typeof r === 'string' && r.trim() ? r.trim() : '',
    ].filter(Boolean)
    if (parts.length) return parts.join(' · ')
  }
  const etRaw = typeof row.entity_type === 'string' ? row.entity_type.trim() : ''
  const cert = typeof row.certificate_name === 'string' ? row.certificate_name.trim() : ''
  const etLabel = etRaw
    ? etRaw.charAt(0).toUpperCase() + etRaw.slice(1).toLowerCase()
    : ''

  if (etLabel && cert) return `${etLabel} · ${cert}`
  if (cert) return cert
  if (etLabel) return etLabel
  return '—'
}

/** Best-effort person: tardiness driver, then recipient employee name, then email, then details. */
async function resolvePersonLabel(row: Record<string, unknown>): Promise<string> {
  const details = parseDetails(row.details)
  const ntype = typeof row.notification_type === 'string' ? row.notification_type : ''

  if (ntype === 'driver_tardiness' && details) {
    const driver = details.driver_name
    if (typeof driver === 'string' && driver.trim()) return driver.trim()
  }

  const rid = row.recipient_employee_id
  const idNum =
    typeof rid === 'number'
      ? rid
      : typeof rid === 'string' && rid.trim() !== ''
        ? Number(rid)
        : NaN

  if (Number.isFinite(idNum) && idNum > 0) {
    const supabase = createClient()
    const { data, error } = await supabase.from('employees').select('full_name').eq('id', idNum).maybeSingle()
    console.debug('[fleet] NotificationRealtimeToasts: recipient lookup', idNum, data?.full_name, error?.message)
    if (data?.full_name?.trim()) return data.full_name.trim()
  }

  const email = row.recipient_email
  if (typeof email === 'string' && email.trim()) return email.trim()

  if (details) {
    const driver = details.driver_name
    if (typeof driver === 'string' && driver.trim()) return driver.trim()
    if (ntype === 'trip_cancellation') {
      const p = details.passenger_name
      const par = details.parent_name
      const bits = [typeof p === 'string' ? p.trim() : '', typeof par === 'string' ? par.trim() : ''].filter(Boolean)
      if (bits.length) return bits.join(' · ')
    }
  }

  return ''
}

/**
 * Dashboard-wide Supabase Realtime on `notifications` INSERT + top-right toasts.
 * Line 1: humanized notification_type. Line 2: entity + certificate. Line 3: person if known.
 */
export function NotificationRealtimeToasts() {
  const router = useRouter()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((key: string) => {
    const t = timersRef.current.get(key)
    if (t) {
      clearTimeout(t)
      timersRef.current.delete(key)
    }
    setToasts((prev) => prev.filter((x) => x.key !== key))
  }, [])

  const pushToast = useCallback(
    (row: Record<string, unknown>) => {
      const recordId = typeof row.id === 'number' ? row.id : Number(row.id)
      if (!Number.isFinite(recordId)) return

      const key = `ins-${recordId}-${Date.now()}`
      const notificationTypeLine = humanizeNotificationType(row)
      const entityAndCertLine = buildEntityAndCertificateLine(row)

      void (async () => {
        const person = await resolvePersonLabel(row)
        const personLine = person.trim() ? person.trim() : null

        const item: ToastItem = {
          key,
          recordId,
          notificationTypeLine,
          entityAndCertLine,
          personLine,
        }

        setToasts((prev) => [...prev, item].slice(-MAX_TOASTS))

        const timer = setTimeout(() => removeToast(key), TOAST_MS)
        timersRef.current.set(key, timer)

        if (row.notification_type === 'certificate_expiry' || row.notification_type === 'trip_cancellation') {
          emitComplianceNotificationsChanged('realtime-notifications-insert-toast')
        }
        console.debug(
          '[fleet] NotificationRealtimeToasts: new row',
          recordId,
          notificationTypeLine,
          entityAndCertLine,
          personLine,
          row.notification_type
        )
      })()
    },
    [removeToast]
  )

  const goCompliance = useCallback(
    (key: string) => {
      removeToast(key)
      router.push(COMPLIANCE_PATH)
      console.debug('[fleet] NotificationRealtimeToasts: navigate', COMPLIANCE_PATH)
    },
    [router, removeToast]
  )

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('dashboard_notifications_insert_toasts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null
          if (row) pushToast(row)
        }
      )
      .subscribe((status, err) => {
        console.debug(
          '[fleet] NotificationRealtimeToasts Realtime',
          status,
          err && typeof err === 'object' && 'message' in err ? (err as Error).message : err ?? ''
        )
      })

    return () => {
      timersRef.current.forEach((t) => clearTimeout(t))
      timersRef.current.clear()
      supabase.removeChannel(channel)
    }
  }, [pushToast])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-[300] flex w-[min(100vw-2rem,22rem)] flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.key}
          className="notification-toast-enter pointer-events-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5"
        >
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => goCompliance(t.key)}
              className="flex min-w-0 flex-1 items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                <span className="block text-sm font-semibold leading-snug text-slate-900">
                  {t.notificationTypeLine}
                </span>
                <span className="block text-xs text-slate-600 line-clamp-2">{t.entityAndCertLine}</span>
                {t.personLine ? (
                  <span className="block text-xs font-medium text-slate-800 line-clamp-2">{t.personLine}</span>
                ) : null}
                <span className="mt-1 block text-[11px] font-medium text-primary">Tap to open Compliance →</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => removeToast(t.key)}
              className="shrink-0 border-l border-slate-100 px-3 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss notification"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
          <div className="h-1 bg-slate-100">
            <div
              className="h-full rounded-none bg-primary/80"
              style={{
                width: '100%',
                animation: `toast-timer-shrink ${TOAST_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
