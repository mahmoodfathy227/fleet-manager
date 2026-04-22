'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import {
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  X,
  ClipboardList,
  ArrowUp,
  ArrowDown,
  Car,
  User,
  HelpCircle,
} from 'lucide-react'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import {
  daysFromTodayToExpiryDate,
  formatDaysFromTodayLabel,
  orderComplianceNotificationsListForPage,
  sortPendingComplianceByMode,
  sortResolvedComplianceByMode,
} from '@/lib/complianceNotificationsDisplay'
import { withEntityDisplayLabels } from '@/lib/complianceEntityDisplayLabel'

const COMPLIANCE_DASHBOARD_NOTIFICATION_TYPES = ['certificate_expiry'] as const

/** Leading row icon: vehicle (blue) vs staff (green) in a clear roundel. */
function EntitySubjectKindIcon({ entityType }: { entityType: string | null }) {
  const t = typeof entityType === 'string' ? entityType.trim().toLowerCase() : ''
  const roundel = 'inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm shrink-0'
  if (t === 'vehicle') {
    return (
      <span
        className={cn(
          roundel,
          'bg-sky-100 text-sky-700 ring-2 ring-sky-300/90'
        )}
        title="Vehicle — document or check for this vehicle"
      >
        <Car className="h-5 w-5" strokeWidth={2.35} aria-hidden />
        <span className="sr-only">Vehicle</span>
      </span>
    )
  }
  if (t === 'driver' || t === 'assistant') {
    return (
      <span
        className={cn(
          roundel,
          'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300/90'
        )}
        title="Staff — document or check for this person"
      >
        <User className="h-5 w-5" strokeWidth={2.35} aria-hidden />
        <span className="sr-only">Staff</span>
      </span>
    )
  }
  return (
    <span
      className={cn(roundel, 'bg-amber-100 text-amber-800 ring-2 ring-amber-300/80')}
      title="Other reminder type"
    >
      <HelpCircle className="h-5 w-5" strokeWidth={2.35} aria-hidden />
      <span className="sr-only">Other</span>
    </span>
  )
}

type ComplianceCategoryFilter = 'all' | 'vehicle' | 'staff'

function complianceCategoryFilterLabel(value: string): string {
  if (value === 'all') return 'Everything'
  if (value === 'vehicle') return 'Vehicles only'
  if (value === 'staff') return 'Staff only'
  return value
}

type TimeLeftColumnSort = 'default' | 'asc' | 'desc'

/** Days-until-expiry sort: asc = least time left first; desc = most time left first. */
function sortPendingByTimeLeft<T extends { id: number; expiry_date: string | null; created_at: string }>(
  items: T[],
  dir: 'asc' | 'desc'
): T[] {
  const cmp = (a: T, b: T) => {
    const da = daysFromTodayToExpiryDate(a.expiry_date)
    const db = daysFromTodayToExpiryDate(b.expiry_date)
    if (da !== db) return dir === 'asc' ? da - db : db - da
    const ta = Date.parse(a.created_at)
    const tb = Date.parse(b.created_at)
    if (Number.isFinite(tb) && Number.isFinite(ta) && tb !== ta) return tb - ta
    return b.id - a.id
  }
  return [...items].sort(cmp)
}

interface Notification {
  id: number
  notification_type: string
  entity_type: string | null
  entity_id: number | null
  certificate_type: string | null
  certificate_name: string | null
  expiry_date: string | null
  days_until_expiry?: number
  recipient_employee_id: number | null
  recipient_email: string | null
  status: 'pending' | 'sent' | 'resolved' | 'dismissed'
  email_sent_at: string | null
  email_token: string | null
  resolved_at: string | null
  created_at: string
  employee_response_type?: string | null
  employee_response_details?: any
  employee_response_received_at?: string | null
  admin_response_required?: boolean
  admin_response_notes?: string | null
  details?: any
  recipient?: {
    full_name: string
    personal_email: string
  }
  /** Set by SSR / refetch: vehicle reg/identifier or staff name for the Related to column. */
  entity_display_label?: string
}

interface ComplianceNotificationsClientProps {
  initialNotifications: Notification[]
}

export function ComplianceNotificationsClient({ initialNotifications }: ComplianceNotificationsClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [sendingEmail, setSendingEmail] = useState<number | null>(null)
  const [dismissing, setDismissing] = useState<number | null>(null)
  const [emailEditorOpen, setEmailEditorOpen] = useState(false)
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [holdOnSend, setHoldOnSend] = useState(true)
  const [includeAppointmentLink, setIncludeAppointmentLink] = useState(true)
  const [selectedRecipient, setSelectedRecipient] = useState<string>('')
  const [availableRecipients, setAvailableRecipients] = useState<Array<{ email: string; name: string; type: string }>>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [openingUpdates, setOpeningUpdates] = useState<number | null>(null)
  const [resolving, setResolving] = useState<number | null>(null)
  /** When Time left sort is cleared (↑↓ off), pending list uses newest reminders first (by created_at). */
  const listSortMode = 'newest' as const
  const [entityFilter, setEntityFilter] = useState<ComplianceCategoryFilter>('all')
  const [timeLeftColumnSort, setTimeLeftColumnSort] = useState<TimeLeftColumnSort>('asc')
  const previousNotificationIds = useRef<Set<number>>(new Set(initialNotifications.map((n) => n.id)))
  /** Until the first client refresh finishes, do not treat rows as "new" (avoids spam vs SSR + refetch churn). */
  const suppressBrowserAlertsUntilFirstSyncRef = useRef(true)
  const realtimeRefetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    console.debug(
      '[fleet] ComplianceNotificationsClient: top help = vehicle/staff line + 4 action bullets',
      COMPLIANCE_DASHBOARD_NOTIFICATION_TYPES
    )
    console.debug('[fleet] ComplianceNotificationsClient: button legend + Related to column with name + link')
    console.debug(
      '[fleet] ComplianceNotificationsClient: default pending sort = least time left first (Time left ↑); cleared = newest-first'
    )
    console.debug(
      '[fleet] ComplianceNotificationsClient: browser alerts only after first sync, tab visible, truly new ids'
    )
    console.debug('[fleet] ComplianceNotificationsClient: admin pin / yellow row highlight removed')
    console.debug('[fleet] ComplianceNotificationsClient: Related to column + vehicle/staff row icons')
    console.debug(
      '[fleet] ComplianceNotificationsClient: Contact email column compact (11px/10px, truncate, ~9rem)'
    )
    console.debug(
      '[fleet] ComplianceNotificationsClient: Document affected = certificate name only (vehicle/staff icon in first column)'
    )
    console.debug('[fleet] ComplianceNotificationsClient: Status column = Expired | Pending only (from expiry date)')
    console.debug(
      '[fleet] ComplianceNotificationsClient: Actions colors — Updates violet, Done always green-600'
    )
  }, [])

  useEffect(() => {
    console.debug('[fleet] ComplianceNotificationsClient: category filter', entityFilter)
  }, [entityFilter])

  useEffect(() => {
    console.debug('[fleet] ComplianceNotificationsClient: Time left column sort', timeLeftColumnSort)
  }, [timeLeftColumnSort])

  // Initialize AudioContext
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Play sound notification
  const playNotificationSound = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const audioContext = audioContextRef.current

      // Resume AudioContext if suspended (happens when tab is in background)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800 // Frequency in Hz
      oscillator.type = 'sine'

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (error) {
      console.error('Error playing notification sound:', error)
    }
  }

  // Show browser notification
  const showBrowserNotification = (notification: Notification) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const title = 'Certificate due date'
    const d = daysFromTodayToExpiryDate(notification.expiry_date)
    const body = notification.certificate_name
      ? `${notification.certificate_name} — ${formatDaysFromTodayLabel(d)}`
      : 'New certificate due date notification'

    console.debug('[fleet] ComplianceNotificationsClient: browser notification', notification.id, notification.notification_type)
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `compliance-${notification.id}`,
      requireInteraction: false
    })
  }

  const parseDetailsOnRows = (rows: any[]) => {
    rows.forEach((notification: any) => {
      if (notification.details && typeof notification.details === 'string') {
        try {
          notification.details = JSON.parse(notification.details)
        } catch {
          /* keep string */
        }
      }
    })
  }

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        recipient:recipient_employee_id(full_name, personal_email)
      `)
      .in('notification_type', [...COMPLIANCE_DASHBOARD_NOTIFICATION_TYPES])
      .order('created_at', { ascending: false })
      .limit(150)

    if (error) {
      console.error('[fleet] compliance fetch notifications', error)
      return
    }

    if (!data?.length) {
      previousNotificationIds.current = new Set()
      suppressBrowserAlertsUntilFirstSyncRef.current = true
      setNotifications([])
      return
    }

    parseDetailsOnRows(data)
    const ordered = orderComplianceNotificationsListForPage(data as Notification[])
    const labeled = await withEntityDisplayLabels(supabase, ordered)

    const currentIds = new Set(labeled.map((n) => n.id))
    const newNotifications = labeled.filter((n) => !previousNotificationIds.current.has(n.id))

    const pastFirstClientSync = !suppressBrowserAlertsUntilFirstSyncRef.current
    const tabVisible = typeof document !== 'undefined' && document.visibilityState === 'visible'
    const shouldAlertBrowser =
      pastFirstClientSync && tabVisible && newNotifications.length > 0

    if (shouldAlertBrowser) {
      console.debug(
        '[fleet] ComplianceNotificationsClient: browser alert for new certificate rows (tab visible)',
        newNotifications.map((n) => n.id)
      )
      void playNotificationSound()
      newNotifications.forEach((notification) => showBrowserNotification(notification))
    } else if (newNotifications.length > 0) {
      console.debug('[fleet] ComplianceNotificationsClient: skip browser alert', {
        pastFirstClientSync,
        tabVisible,
        newCount: newNotifications.length,
      })
    }

    suppressBrowserAlertsUntilFirstSyncRef.current = false
    previousNotificationIds.current = currentIds
    setNotifications(labeled)
    console.debug(
      '[fleet] compliance notifications refreshed from Supabase',
      labeled.length,
      COMPLIANCE_DASHBOARD_NOTIFICATION_TYPES
    )
  }, [])

  // Realtime on public.notifications (certificate_expiry only)
  useEffect(() => {
    const supabase = createClient()

    void fetchNotifications()

    const scheduleRealtimeRefetch = () => {
      if (realtimeRefetchDebounceRef.current) clearTimeout(realtimeRefetchDebounceRef.current)
      realtimeRefetchDebounceRef.current = setTimeout(() => {
        realtimeRefetchDebounceRef.current = null
        console.debug('[fleet] compliance notifications: debounced refetch after realtime')
        void fetchNotifications()
      }, 400)
    }

    const channel = supabase
      .channel('compliance_certificate_expiry_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: 'notification_type=eq.certificate_expiry',
        },
        (payload) => {
          console.debug('[fleet] compliance notifications realtime event', payload.eventType, payload)
          scheduleRealtimeRefetch()
        }
      )
      .subscribe((status, err) => {
        console.debug(
          '[fleet] compliance notifications Realtime channel',
          status,
          err?.message ?? err ?? ''
        )
      })

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        console.debug('[fleet] compliance notifications: tab visible, refetch')
        void fetchNotifications()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (realtimeRefetchDebounceRef.current) {
        clearTimeout(realtimeRefetchDebounceRef.current)
        realtimeRefetchDebounceRef.current = null
      }
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [fetchNotifications])

  const handleOpenEmailEditor = async (notification: Notification) => {
    setEditingNotification(notification)
    setLoadingTemplate(true)
    setLoadingRecipients(true)
    setEmailEditorOpen(true)
    setHoldOnSend(true)
    setIncludeAppointmentLink(true)
    setSelectedRecipient(notification.recipient_email || '')

    try {
      // Fetch available recipients
      const recipientsResponse = await fetch('/api/notifications/get-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notification.id }),
      })

      if (recipientsResponse.ok) {
        const recipientsData = await recipientsResponse.json()
        setAvailableRecipients(recipientsData.recipients || [])
        // Set default recipient if available
        if (recipientsData.recipients && recipientsData.recipients.length > 0) {
          const defaultRecipient = recipientsData.recipients.find((r: any) => r.email === notification.recipient_email)
            || recipientsData.recipients[0]
          setSelectedRecipient(defaultRecipient.email)
        }
      }

      // Fetch email template
      const response = await fetch('/api/notifications/get-email-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notification.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load email template')
      }

      setEmailSubject(data.emailTemplate?.subject || '')
      setEmailBody(data.emailTemplate?.body || '')
    } catch (error: any) {
      alert('Error loading email template: ' + error.message)
    } finally {
      setLoadingTemplate(false)
      setLoadingRecipients(false)
    }
  }

  const handleSendEmail = async () => {
    if (!editingNotification) return

    setSendingEmail(editingNotification.id)
    try {
      const response = await fetch('/api/notifications/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: editingNotification.id,
          subject: emailSubject,
          emailBody: emailBody,
          hold: holdOnSend,
          includeAppointmentLink: includeAppointmentLink,
          recipientEmail: selectedRecipient, // Send to selected recipient
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      setNotifications((prev) =>
        orderComplianceNotificationsListForPage(
          prev.map((n) =>
            n.id === editingNotification.id
              ? { ...n, status: 'sent' as const, email_sent_at: new Date().toISOString() }
              : n
          )
        )
      )

      setEmailEditorOpen(false)
      setEditingNotification(null)
      setEmailSubject('')
      setEmailBody('')
      window.dispatchEvent(new CustomEvent('notificationResolved'))
      alert('Email sent successfully!')
    } catch (error: any) {
      alert('Error sending email: ' + error.message)
    } finally {
      setSendingEmail(null)
    }
  }

  const handleDismiss = async (notificationId: number) => {
    setDismissing(notificationId)
    try {
      const response = await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })

      if (!response.ok) {
        throw new Error('Failed to dismiss notification')
      }

      setNotifications((prev) =>
        orderComplianceNotificationsListForPage(
          prev.map((n) => (n.id === notificationId ? { ...n, status: 'dismissed' as const } : n))
        )
      )

      window.dispatchEvent(new CustomEvent('notificationResolved'))
    } catch (error: any) {
      alert('Error dismissing notification: ' + error.message)
    } finally {
      setDismissing(null)
    }
  }

  const handleMarkCompleted = async (notificationId: number) => {
    setResolving(notificationId)
    console.debug('[fleet] ComplianceNotificationsClient: mark reminder completed', notificationId)
    try {
      const response = await fetch('/api/notifications/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || 'Failed to mark completed')
      }

      setNotifications((prev) =>
        orderComplianceNotificationsListForPage(
          prev.map((n) =>
            n.id === notificationId
              ? {
                  ...n,
                  status: 'resolved' as const,
                  resolved_at: new Date().toISOString(),
                  admin_response_required: false,
                }
              : n
          )
        )
      )

      window.dispatchEvent(new CustomEvent('notificationResolved'))
    } catch (error: any) {
      alert(error.message || 'Error marking completed')
    } finally {
      setResolving(null)
    }
  }

  const handleOpenUpdates = async (notificationId: number) => {
    setOpeningUpdates(notificationId)
    console.debug('[fleet] ComplianceNotificationsClient: open Updates from notification', notificationId)
    try {
      const response = await fetch('/api/compliance/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to open updates')
      window.location.href = `/dashboard/compliance/cases/${data.case_id}`
    } catch (e: any) {
      alert(e.message || 'Failed to open updates')
    } finally {
      setOpeningUpdates(null)
    }
  }

  /** Status column: only expiry-based — Expired (past due) vs Pending (today or future). */
  const getStatusIcon = (_status: string, daysFromToday: number) => {
    if (daysFromToday < 0) {
      return <XCircle className="h-5 w-5 text-red-500" />
    }
    return <Clock className="h-5 w-5 text-amber-500" />
  }

  const getStatusBadge = (_status: string, daysFromToday: number) => {
    if (daysFromToday < 0) {
      return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-rose-100 text-rose-700">Expired</span>
    }
    return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700">Pending</span>
  }

  const getEntityLink = (entityType: string | null, entityId: number | null) => {
    if (entityType === 'vehicle' && entityId != null) {
      return `/dashboard/vehicles/${entityId}`
    }
    if ((entityType === 'driver' || entityType === 'assistant') && entityId != null) {
      return `/dashboard/employees/${entityId}`
    }
    return '#'
  }

  /** Canonical buckets: driver + assistant → single "staff" option (no duplicate labels). */
  const categoryFilterOptions = useMemo((): ComplianceCategoryFilter[] => {
    let hasVehicle = false
    let hasStaff = false
    notifications.forEach((n) => {
      const t = typeof n.entity_type === 'string' ? n.entity_type.trim().toLowerCase() : ''
      if (t === 'vehicle') hasVehicle = true
      if (t === 'driver' || t === 'assistant') hasStaff = true
    })
    const opts: ComplianceCategoryFilter[] = ['all']
    if (hasVehicle) opts.push('vehicle')
    if (hasStaff) opts.push('staff')
    return opts
  }, [notifications])

  useEffect(() => {
    if (entityFilter !== 'all' && !categoryFilterOptions.includes(entityFilter)) {
      setEntityFilter('all')
      console.debug('[fleet] ComplianceNotificationsClient: category filter reset to Everything (bucket no longer in list)')
    }
  }, [entityFilter, categoryFilterOptions])

  function notificationMatchesCategoryFilter(n: Notification, filter: ComplianceCategoryFilter): boolean {
    if (filter === 'all') return true
    const t = typeof n.entity_type === 'string' ? n.entity_type.trim().toLowerCase() : ''
    if (filter === 'vehicle') return t === 'vehicle'
    if (filter === 'staff') return t === 'driver' || t === 'assistant'
    return true
  }

  const complianceNotifications = useMemo(() => {
    const pending = notifications.filter((n) => n.status !== 'resolved' && n.status !== 'dismissed')
    const filtered = pending.filter((n) => notificationMatchesCategoryFilter(n, entityFilter))
    if (timeLeftColumnSort === 'default') {
      return sortPendingComplianceByMode(filtered, listSortMode)
    }
    return sortPendingByTimeLeft(filtered, timeLeftColumnSort)
  }, [notifications, entityFilter, timeLeftColumnSort])

  const complianceResolved = useMemo(() => {
    const resolved = notifications.filter((n) => n.status === 'resolved' || n.status === 'dismissed')
    const filtered = resolved.filter((n) => notificationMatchesCategoryFilter(n, entityFilter))
    return sortResolvedComplianceByMode(filtered, listSortMode)
  }, [notifications, entityFilter])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          Notifications for <strong className="text-slate-800">vehicle and staff</strong> documents.
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-700 font-medium hover:text-slate-900">
            What the action icons do
          </summary>
          <ul className="mt-3 space-y-1.5 text-slate-600 pl-5 list-disc list-outside">
            <li>
              <strong>Updates</strong> — same as clicking the row; open notes and the activity log.
            </li>
            <li>
              <strong>Email</strong> — send or resend the reminder message.
            </li>
            <li>
              <strong>Ignore</strong> — hide this reminder without marking it fully done.
            </li>
            <li>
              <strong>Done</strong> (check) — mark the paperwork completed and remove it from the active list.
            </li>
          </ul>
        </details>
      </div>

      {notifications.length > 0 && categoryFilterOptions.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="compliance-entity-filter" className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Show
            </Label>
            <Select
              id="compliance-entity-filter"
              selectSize="sm"
              className="w-[min(100%,16rem)] border-slate-200 bg-white"
              value={entityFilter === 'all' || categoryFilterOptions.includes(entityFilter) ? entityFilter : 'all'}
              onChange={(e) => setEntityFilter(e.target.value as ComplianceCategoryFilter)}
            >
              {categoryFilterOptions.map((value) => (
                <option key={value} value={value}>
                  {complianceCategoryFilterLabel(value)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {complianceNotifications.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">
              {notifications.some((n) => n.status !== 'resolved' && n.status !== 'dismissed')
                ? 'Nothing to show for this filter'
                : 'Nothing needs attention right now'}
            </p>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              {notifications.some((n) => n.status !== 'resolved' && n.status !== 'dismissed')
                ? 'Change &quot;Show&quot; to Everything, or pick Vehicles only / Staff only.'
                : 'When a certificate or check is due, it will appear in this list automatically.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[3.25rem] px-1 text-center align-middle">
                    <span className="sr-only">Vehicle or staff</span>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Document affected</TableHead>
                  <TableHead>Related to</TableHead>
                  <TableHead className="max-w-[9rem] w-[9rem] min-w-0">Contact email</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="min-w-[8.5rem]">
                    <div className="flex items-center gap-2">
                      <span>Time left</span>
                      <div
                        className="inline-flex flex-col rounded border border-slate-200 bg-white overflow-hidden shrink-0"
                        role="group"
                        aria-label="Sort by time until expiry"
                      >
                        <button
                          type="button"
                          className={cn(
                            'p-0.5 leading-none hover:bg-slate-100 text-slate-600',
                            timeLeftColumnSort === 'asc' && 'bg-primary/15 text-primary'
                          )}
                          title="Least time left first (default) — overdue and soonest due at the top. Click again for newest-first order."
                          aria-pressed={timeLeftColumnSort === 'asc'}
                          onClick={() => {
                            setTimeLeftColumnSort((s) => {
                              const next = s === 'asc' ? 'default' : 'asc'
                              console.debug('[fleet] ComplianceNotificationsClient: Time left sort toggle', next)
                              return next
                            })
                          }}
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={cn(
                            'p-0.5 leading-none border-t border-slate-200 hover:bg-slate-100 text-slate-600',
                            timeLeftColumnSort === 'desc' && 'bg-primary/15 text-primary'
                          )}
                          title="Most time left first — furthest due dates at the top. Click again for newest-first order."
                          aria-pressed={timeLeftColumnSort === 'desc'}
                          onClick={() => {
                            setTimeLeftColumnSort((s) => {
                              const next = s === 'desc' ? 'default' : 'desc'
                              console.debug('[fleet] ComplianceNotificationsClient: Time left sort toggle', next)
                              return next
                            })
                          }}
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </TableHead>
                  <TableHead>Their reply</TableHead>
                  <TableHead className="min-w-[10rem]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complianceNotifications.map((notification) => {
                  const daysFromToday = daysFromTodayToExpiryDate(notification.expiry_date)

                  const onRowActivate = () => {
                    if (openingUpdates === notification.id) return
                    console.debug('[fleet] ComplianceNotificationsClient: row click open Updates', notification.id)
                    void handleOpenUpdates(notification.id)
                  }

                  const statusInner = (
                    <div className="flex items-center gap-2">
                      {getStatusIcon(notification.status, daysFromToday)}
                      {getStatusBadge(notification.status, daysFromToday)}
                    </div>
                  )

                  return (
                  <TableRow
                    key={notification.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={onRowActivate}
                    title="Click to open Updates for this reminder"
                  >
                    <TableCell className="w-[3.25rem] px-1 text-center align-middle">
                      <div className="flex justify-center">
                        <EntitySubjectKindIcon entityType={notification.entity_type} />
                      </div>
                    </TableCell>
                    <TableCell>{statusInner}</TableCell>
                    <TableCell>
                        <div className="font-semibold text-slate-800">{notification.certificate_name}</div>
                    </TableCell>
                    <TableCell>
                        <Link
                          href={getEntityLink(notification.entity_type, notification.entity_id)}
                          className="text-primary hover:text-primary/80 hover:underline inline-flex items-center gap-1.5 font-medium text-slate-800 max-w-[14rem]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate" title={notification.entity_display_label}>
                            {notification.entity_display_label ?? '—'}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                        </Link>
                    </TableCell>
                    <TableCell className="max-w-[9rem] min-w-0 align-top py-2">
                        <div className="min-w-0">
                          <div
                            className="text-[11px] leading-snug font-medium text-slate-800 truncate"
                            title={notification.recipient_email?.trim() || undefined}
                          >
                            {notification.recipient_email?.trim() || 'No email'}
                          </div>
                          {notification.recipient?.full_name?.trim() ? (
                            <div
                              className="text-[10px] leading-tight text-slate-500 mt-0.5 truncate"
                              title={notification.recipient.full_name}
                            >
                              {notification.recipient.full_name}
                            </div>
                          ) : null}
                        </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(notification.expiry_date)}</TableCell>
                    <TableCell>
                        <span
                          className={`font-semibold ${
                            daysFromToday < 0
                              ? 'text-rose-600'
                              : daysFromToday <= 7
                                ? 'text-orange-600'
                                : 'text-slate-700'
                          }`}
                        >
                          {formatDaysFromTodayLabel(daysFromToday)}
                        </span>
                    </TableCell>
                    <TableCell>
                      {notification.admin_response_required && notification.employee_response_type ? (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                              ⚠️ Waiting for your OK
                            </span>
                          </div>
                          {notification.employee_response_type === 'document_uploaded' && notification.employee_response_details && (
                            <div className="text-xs text-gray-600">
                              <div>📄 {notification.employee_response_details.filesUploaded || 0} file(s) uploaded</div>
                              {notification.employee_response_details.fileNames && notification.employee_response_details.fileNames.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {notification.employee_response_details.fileNames.slice(0, 2).join(', ')}
                                  {notification.employee_response_details.fileNames.length > 2 && ` +${notification.employee_response_details.fileNames.length - 2} more`}
                                </div>
                              )}
                              {notification.employee_response_received_at && (
                                <div className="text-xs text-gray-400 mt-1">
                                  {formatDateTime(notification.employee_response_received_at)}
                                </div>
                              )}
                            </div>
                          )}
                          {notification.employee_response_type === 'appointment_booked' && notification.employee_response_details && (
                            <div className="text-xs text-gray-600">
                              <div>📅 Appointment booked</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {notification.employee_response_details.appointmentDate || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {notification.employee_response_details.appointmentTime || 'N/A'}
                              </div>
                              {notification.employee_response_received_at && (
                                <div className="text-xs text-gray-400 mt-1">
                                  {formatDateTime(notification.employee_response_received_at)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : notification.employee_response_type ? (
                        <div className="text-xs text-gray-500">
                          {notification.employee_response_type === 'document_uploaded' ? '📄 Documents uploaded' : '📅 Appointment booked'}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">They have not replied yet</div>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div
                        className="flex flex-nowrap items-center gap-1"
                        role="group"
                        aria-label="Reminder actions"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleOpenUpdates(notification.id)
                          }}
                          disabled={openingUpdates === notification.id}
                          title="Updates — notes and activity log"
                          className={cn(
                            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1',
                            'disabled:pointer-events-none disabled:opacity-45',
                            'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 hover:border-violet-400'
                          )}
                        >
                          <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="sr-only">Open updates</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEmailEditor(notification)
                          }}
                          disabled={
                            sendingEmail === notification.id ||
                            !notification.recipient_email ||
                            (notification.status !== 'pending' && notification.status !== 'sent')
                          }
                          title={
                            !notification.recipient_email
                              ? 'No recipient email on file'
                              : notification.status === 'sent'
                                ? 'Resend email'
                                : 'Send reminder email'
                          }
                          className={cn(
                            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1',
                            'disabled:pointer-events-none disabled:opacity-45',
                            notification.status === 'sent'
                              ? 'border-sky-200 bg-white text-sky-600 hover:bg-sky-50 hover:border-sky-300'
                              : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                          )}
                        >
                          <Mail className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="sr-only">Email</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDismiss(notification.id)
                          }}
                          disabled={dismissing === notification.id}
                          title="Ignore — hide without marking done"
                          className={cn(
                            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1',
                            'disabled:pointer-events-none disabled:opacity-45',
                            'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-300'
                          )}
                        >
                          <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="sr-only">Ignore</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleMarkCompleted(notification.id)
                          }}
                          disabled={resolving === notification.id}
                          title={
                            notification.admin_response_required
                              ? 'Approve their reply and mark completed'
                              : 'Mark completed — paperwork finished'
                          }
                          className={cn(
                            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1',
                            'disabled:pointer-events-none disabled:opacity-45',
                            '!border-transparent bg-green-600 text-white hover:bg-green-700 shadow-sm'
                          )}
                        >
                          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="sr-only">Mark completed</span>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {complianceResolved.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-slate-700 hover:text-slate-900 font-medium">
            Show finished or ignored reminders ({complianceResolved.length})
          </summary>
          <p className="text-xs text-slate-500 mt-2 mb-0 max-w-xl">
            These are already marked done or ignored. Open a row if you still need the updates history.
          </p>
          <Card className="mt-4 border-slate-200 rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[3.25rem] px-1 text-center align-middle">
                      <span className="sr-only">Vehicle or staff</span>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Document affected</TableHead>
                    <TableHead>Related to</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Closed on</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complianceResolved.map((notification) => {
                    const daysResolved = daysFromTodayToExpiryDate(notification.expiry_date)
                    const onResolvedRowClick = () => {
                      if (openingUpdates === notification.id) return
                      console.debug('[fleet] ComplianceNotificationsClient: resolved row open Updates', notification.id)
                      void handleOpenUpdates(notification.id)
                    }
                    return (
                    <TableRow
                      key={notification.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={onResolvedRowClick}
                      title="Click to open Updates"
                    >
                      <TableCell className="w-[3.25rem] px-1 text-center align-middle">
                        <div className="flex justify-center">
                          <EntitySubjectKindIcon entityType={notification.entity_type} />
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(notification.status, daysResolved)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">
                        {notification.certificate_name}
                      </TableCell>
                      <TableCell>
                          <Link
                            href={getEntityLink(notification.entity_type, notification.entity_id)}
                            className="text-primary hover:underline inline-flex items-center gap-1.5 font-medium max-w-[14rem]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate" title={notification.entity_display_label}>
                              {notification.entity_display_label ?? '—'}
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                          </Link>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {formatDate(notification.expiry_date)}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {notification.resolved_at ? formatDateTime(notification.resolved_at) : 'N/A'}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </details>
      )}

      {/* Email Editor Modal */}
      {emailEditorOpen && editingNotification && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto border-slate-200 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-900">Send reminder email</h2>
                <button
                  onClick={() => {
                    setEmailEditorOpen(false)
                    setEditingNotification(null)
                    setEmailSubject('')
                    setEmailBody('')
                    setSelectedRecipient('')
                    setAvailableRecipients([])
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {loadingTemplate ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-slate-500">Loading email template...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                      <input
                        id="hold-on-send"
                        type="checkbox"
                        checked={holdOnSend}
                        onChange={(e) => setHoldOnSend(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <Label htmlFor="hold-on-send" className="text-slate-800">Pause work until we clear it</Label>
                        <p className="text-xs text-slate-500">
                          After sending, marks the person / vehicle (and linked routes) as on hold until an admin removes it.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                      <input
                        id="include-appointment-link"
                        type="checkbox"
                        checked={includeAppointmentLink}
                        onChange={(e) => setIncludeAppointmentLink(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <div>
                        <Label htmlFor="include-appointment-link" className="text-slate-800">Add link to book an appointment</Label>
                        <p className="text-xs text-slate-500">
                          Puts a link in the email so they can pick a time you have made available.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email-to" className="text-slate-700">To *</Label>
                    {loadingRecipients ? (
                      <div className="text-sm text-slate-500">Loading recipients...</div>
                    ) : availableRecipients.length > 0 ? (
                      <select
                        id="email-to"
                        value={selectedRecipient}
                        onChange={(e) => setSelectedRecipient(e.target.value)}
                        className="mt-1 flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        required
                      >
                        {availableRecipients.map((recipient) => (
                          <option key={recipient.email} value={recipient.email}>
                            {recipient.name} ({recipient.type === 'driver' ? 'Driver' : recipient.type === 'passenger_assistant' ? 'PA' : 'Assigned Employee'}) - {recipient.email}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id="email-to"
                        value={selectedRecipient}
                        onChange={(e) => setSelectedRecipient(e.target.value)}
                        placeholder="Enter email address"
                        className="mt-1"
                        required
                      />
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {editingNotification.entity_type === 'vehicle'
                        ? 'Select the driver, PA, or assigned employee to send the email to.'
                        : 'Email will be sent to the driver/PA.'}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="email-subject" className="text-slate-700">Subject *</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email-body" className="text-slate-700">Message *</Label>
                    <textarea
                      id="email-body"
                      rows={15}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      required
                      className="mt-1 flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      You can change the wording. A link to upload proof is added automatically where needed.
                    </p>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEmailEditorOpen(false)
                        setEditingNotification(null)
                        setEmailSubject('')
                        setEmailBody('')
                        setSelectedRecipient('')
                        setAvailableRecipients([])
                      }}
                      className="text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendEmail}
                      disabled={sendingEmail === editingNotification.id || !emailSubject.trim() || !emailBody.trim() || !selectedRecipient.trim()}
                      className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {sendingEmail === editingNotification.id ? 'Sending...' : 'Send Email'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

