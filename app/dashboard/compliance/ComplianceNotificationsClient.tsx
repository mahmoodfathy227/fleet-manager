'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Mail, CheckCircle, XCircle, AlertTriangle, Clock, ExternalLink, X, FolderOpen, ShieldAlert } from 'lucide-react'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { createClient } from '@/lib/supabase/client'
import {
  type ComplianceListSortMode,
  daysFromTodayToExpiryDate,
  formatDaysFromTodayLabel,
  orderComplianceNotificationsListForPage,
  sortPendingComplianceByMode,
  sortResolvedComplianceByMode,
} from '@/lib/complianceNotificationsDisplay'
import { loadUserAdminPinIds, saveUserAdminPinIds } from '@/lib/complianceUserAdminPins'

const COMPLIANCE_DASHBOARD_NOTIFICATION_TYPES = ['certificate_expiry', 'trip_cancellation'] as const

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
}

interface ComplianceNotificationsClientProps {
  initialNotifications: Notification[]
}

export function ComplianceNotificationsClient({ initialNotifications }: ComplianceNotificationsClientProps) {
  const router = useRouter()
  const { has, loading: permissionsLoading } = usePermissions()
  const canAdminReviewFocus = has('compliance.write') || has('users.manage')

  const [notifications, setNotifications] = useState(initialNotifications)
  const [sendingEmail, setSendingEmail] = useState<number | null>(null)
  const [dismissing, setDismissing] = useState<number | null>(null)
  const [resolving, setResolving] = useState<number | null>(null)
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
  const [openingCase, setOpeningCase] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<ComplianceListSortMode>('newest')
  const [entityFilter, setEntityFilter] = useState<'all' | string>('all')
  const [userAdminPinnedIds, setUserAdminPinnedIds] = useState<Set<number>>(() =>
    typeof window !== 'undefined' ? loadUserAdminPinIds() : new Set()
  )
  const previousNotificationIds = useRef<Set<number>>(new Set(initialNotifications.map(n => n.id)))
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    console.debug(
      '[fleet] ComplianceNotificationsClient: per-row admin pin (localStorage) + confirm; row→open case or route; sort + entity; types',
      COMPLIANCE_DASHBOARD_NOTIFICATION_TYPES
    )
    console.debug(
      '[fleet] ComplianceNotificationsClient: trip_cancellation rows leave Expiry Date + From today columns empty'
    )
  }, [])

  useEffect(() => {
    const valid = new Set(notifications.map((n) => n.id))
    setUserAdminPinnedIds((prev) => {
      let changed = false
      const next = new Set<number>()
      Array.from(prev).forEach((id) => {
        if (valid.has(id)) next.add(id)
        else changed = true
      })
      if (changed) saveUserAdminPinIds(next)
      return changed ? next : prev
    })
  }, [notifications])

  useEffect(() => {
    console.debug('[fleet] ComplianceNotificationsClient: sort mode', sortMode)
  }, [sortMode])

  useEffect(() => {
    console.debug('[fleet] ComplianceNotificationsClient: entity filter', entityFilter)
  }, [entityFilter])

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

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
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

    const title =
      notification.notification_type === 'trip_cancellation'
        ? 'Trip cancellation'
        : 'New Compliance Notification'
    const tripDetails =
      notification.notification_type === 'trip_cancellation' &&
      notification.details &&
      typeof notification.details === 'object' &&
      !Array.isArray(notification.details)
        ? (notification.details as Record<string, unknown>)
        : null
    const tripDate =
      tripDetails && typeof tripDetails.trip_date === 'string' ? tripDetails.trip_date : null
    const d = tripDate
      ? daysFromTodayToExpiryDate(tripDate)
      : daysFromTodayToExpiryDate(notification.expiry_date)
    const body =
      notification.notification_type === 'trip_cancellation'
        ? [
            typeof tripDetails?.route_number === 'string' ? tripDetails.route_number : 'Route',
            typeof tripDetails?.passenger_name === 'string' ? tripDetails.passenger_name : '',
            tripDate ? formatDaysFromTodayLabel(d) : '',
          ]
            .filter(Boolean)
            .join(' — ') || 'Trip cancellation'
        : notification.certificate_name
          ? `${notification.certificate_name} — ${formatDaysFromTodayLabel(d)}`
          : 'New compliance notification received'

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
      setNotifications([])
      return
    }

    parseDetailsOnRows(data)
    const ordered = orderComplianceNotificationsListForPage(data as Notification[])

    const currentIds = new Set(ordered.map((n) => n.id))
    const newNotifications = ordered.filter((n) => !previousNotificationIds.current.has(n.id))

    if (newNotifications.length > 0) {
      playNotificationSound()
      newNotifications.forEach((notification) => showBrowserNotification(notification))
    }

    previousNotificationIds.current = currentIds
    setNotifications(ordered)
    console.debug(
      '[fleet] compliance notifications refreshed from Supabase',
      ordered.length,
      COMPLIANCE_DASHBOARD_NOTIFICATION_TYPES
    )
  }, [])

  // Realtime on public.notifications (certificate_expiry + trip_cancellation)
  useEffect(() => {
    const supabase = createClient()

    fetchNotifications()

    const channel = supabase
      .channel('compliance_certificate_expiry_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: 'notification_type=in.(certificate_expiry,trip_cancellation)',
        },
        (payload) => {
          console.debug('[fleet] compliance notifications realtime event', payload.eventType, payload)
          void fetchNotifications()
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

  const handleOpenCase = async (notificationId: number) => {
    setOpeningCase(notificationId)
    try {
      const response = await fetch('/api/compliance/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to open case')
      window.location.href = `/dashboard/compliance/cases/${data.case_id}`
    } catch (e: any) {
      alert(e.message || 'Failed to open case')
    } finally {
      setOpeningCase(null)
    }
  }

  const requestToggleUserAdminPin = useCallback((notificationId: number) => {
    const pinned = userAdminPinnedIds.has(notificationId)
    if (pinned) {
      if (
        !window.confirm(
          'Remove this row from admin priority?\n\nIt will no longer be highlighted in yellow and will sort like other notifications until you mark it again.'
        )
      ) {
        return
      }
      setUserAdminPinnedIds((prev) => {
        const next = new Set(prev)
        next.delete(notificationId)
        saveUserAdminPinIds(next)
        console.debug('[fleet] ComplianceNotificationsClient: user admin pin removed', notificationId)
        return next
      })
      return
    }
    if (
      !window.confirm(
        'Send this notification to admin priority?\n\nIt will be highlighted in yellow and pinned to the top of the list (for every sort option) until you remove it with the shield icon.'
      )
    ) {
      return
    }
    setUserAdminPinnedIds((prev) => {
      const next = new Set(prev)
      next.add(notificationId)
      saveUserAdminPinIds(next)
      console.debug('[fleet] ComplianceNotificationsClient: user admin pin added', notificationId)
      return next
    })
  }, [userAdminPinnedIds])

  const handleResolve = async (notificationId: number) => {
    setResolving(notificationId)
    try {
      const response = await fetch('/api/notifications/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      })

      if (!response.ok) {
        throw new Error('Failed to resolve notification')
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
      alert('Error resolving notification: ' + error.message)
    } finally {
      setResolving(null)
    }
  }

  const getStatusIcon = (status: string, daysFromToday: number) => {
    if (status === 'resolved' || status === 'dismissed') {
      return <CheckCircle className="h-5 w-5 text-gray-400" />
    }
    if (daysFromToday < 0) {
      return <XCircle className="h-5 w-5 text-red-500" />
    }
    if (daysFromToday <= 7) {
      return <AlertTriangle className="h-5 w-5 text-orange-500" />
    }
    return <Clock className="h-5 w-5 text-yellow-500" />
  }

  const getStatusBadge = (status: string, daysFromToday: number) => {
    if (status === 'resolved') {
      return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">Resolved</span>
    }
    if (status === 'dismissed') {
      return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600">Dismissed</span>
    }
    if (status === 'sent') {
      return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-sky-100 text-sky-700">Email Sent</span>
    }
    if (daysFromToday < 0) {
      return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-rose-100 text-rose-700">Expired</span>
    }
    if (daysFromToday <= 7) {
      return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-orange-100 text-orange-700">Urgent</span>
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

  const entityTypeOptions = useMemo(() => {
    const types = new Set<string>()
    let hasTripCancellation = false
    notifications.forEach((n) => {
      if (n.notification_type === 'trip_cancellation') {
        hasTripCancellation = true
        return
      }
      const t = typeof n.entity_type === 'string' ? n.entity_type.trim() : ''
      if (t) types.add(t)
    })
    const sorted = Array.from(types).sort((a, b) => a.localeCompare(b))
    if (hasTripCancellation) {
      return ['all', 'trip_cancellation', ...sorted]
    }
    return ['all', ...sorted]
  }, [notifications])

  useEffect(() => {
    if (entityFilter !== 'all' && !entityTypeOptions.includes(entityFilter)) {
      setEntityFilter('all')
      console.debug('[fleet] ComplianceNotificationsClient: entity filter reset to all (type no longer in list)')
    }
  }, [entityFilter, entityTypeOptions])

  const complianceNotifications = useMemo(() => {
    const pending = notifications.filter((n) => n.status !== 'resolved' && n.status !== 'dismissed')
    const filtered =
      entityFilter === 'all'
        ? pending
        : entityFilter === 'trip_cancellation'
          ? pending.filter((n) => n.notification_type === 'trip_cancellation')
          : pending.filter((n) => n.entity_type === entityFilter)
    return sortPendingComplianceByMode(filtered, sortMode, userAdminPinnedIds)
  }, [notifications, sortMode, entityFilter, userAdminPinnedIds])

  const complianceResolved = useMemo(() => {
    const resolved = notifications.filter((n) => n.status === 'resolved' || n.status === 'dismissed')
    const filtered =
      entityFilter === 'all'
        ? resolved
        : entityFilter === 'trip_cancellation'
          ? resolved.filter((n) => n.notification_type === 'trip_cancellation')
          : resolved.filter((n) => n.entity_type === entityFilter)
    return sortResolvedComplianceByMode(filtered, sortMode, userAdminPinnedIds)
  }, [notifications, sortMode, entityFilter, userAdminPinnedIds])

  return (
    <div className="space-y-6">
      {notifications.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="compliance-sort-mode" className="text-sm font-medium text-slate-600 whitespace-nowrap">
              Sort by
            </Label>
            <Select
              id="compliance-sort-mode"
              selectSize="sm"
              className="w-[min(100%,16rem)] border-slate-200"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as ComplianceListSortMode)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="importance">Urgency &amp; importance</option>
            </Select>
          </div>
          {entityTypeOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="compliance-entity-filter" className="text-sm font-medium text-slate-600 whitespace-nowrap">
                Entity
              </Label>
              <Select
                id="compliance-entity-filter"
                selectSize="sm"
                className="w-[min(100%,14rem)] border-slate-200"
                value={entityFilter === 'all' || entityTypeOptions.includes(entityFilter) ? entityFilter : 'all'}
                onChange={(e) => setEntityFilter(e.target.value)}
              >
                {entityTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all'
                      ? 'All entities'
                      : value === 'trip_cancellation'
                        ? 'Trip cancellations'
                        : value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      )}

      {complianceNotifications.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {notifications.some((n) => n.status !== 'resolved' && n.status !== 'dismissed')
                ? 'No pending notifications match this filter'
                : 'No pending compliance notifications'}
            </p>
            <p className="text-sm text-slate-400">
              {notifications.some((n) => n.status !== 'resolved' && n.status !== 'dismissed')
                ? 'Try choosing a different entity or All entities.'
                : 'All certificates are up to date'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Certificate</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>From today</TableHead>
                  <TableHead>Employee Response</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complianceNotifications.map((notification) => {
                  const trip = notification.notification_type === 'trip_cancellation'
                  const td =
                    notification.details &&
                    typeof notification.details === 'object' &&
                    !Array.isArray(notification.details)
                      ? (notification.details as Record<string, unknown>)
                      : {}
                  const routeIdRaw = td.route_id
                  const routeIdNum = typeof routeIdRaw === 'number' ? routeIdRaw : Number(routeIdRaw)
                  const routeIdOk = Number.isFinite(routeIdNum) && routeIdNum > 0
                  const daysFromToday = daysFromTodayToExpiryDate(notification.expiry_date)
                  const needsAdmin = !!notification.admin_response_required
                  const userPinned = userAdminPinnedIds.has(notification.id)

                  const onRowActivate = () => {
                    if (openingCase === notification.id) return
                    if (trip) {
                      if (routeIdOk) {
                        console.debug('[fleet] ComplianceNotificationsClient: trip row → route', routeIdNum)
                        router.push(`/dashboard/routes/${routeIdNum}`)
                      } else {
                        console.debug(
                          '[fleet] ComplianceNotificationsClient: trip row click, missing route_id',
                          notification.id
                        )
                      }
                      return
                    }
                    console.debug('[fleet] ComplianceNotificationsClient: row click open case', notification.id)
                    void handleOpenCase(notification.id)
                  }

                  const statusInner =
                    trip && (notification.status === 'pending' || notification.status === 'sent') ? (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-violet-600" />
                        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-violet-100 text-violet-800">
                          Trip cancellation
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {getStatusIcon(notification.status, daysFromToday)}
                        {getStatusBadge(notification.status, daysFromToday)}
                      </div>
                    )

                  return (
                  <TableRow
                    key={notification.id}
                    className={cn(
                      'cursor-pointer hover:bg-slate-50',
                      userPinned &&
                        'z-[1] bg-yellow-100 shadow-[inset_0_0_0_2px_rgba(234,179,8,0.9)] border-l-4 border-yellow-500',
                      !userPinned && needsAdmin && 'bg-amber-50 border-l-4 border-amber-400'
                    )}
                    onClick={onRowActivate}
                    title={
                      trip
                        ? routeIdOk
                          ? 'Open route — click row'
                          : 'Trip cancellation — use actions if no route link'
                        : 'Open compliance case — click row; use icons for other actions'
                    }
                  >
                    <TableCell>{statusInner}</TableCell>
                    <TableCell>
                      {trip ? (
                        <div>
                          <div className="font-semibold text-slate-800">Trip cancellation</div>
                          <div className="text-xs text-slate-500">
                            {typeof td.reason === 'string' && td.reason.trim() ? td.reason : 'No reason provided'}
                          </div>
                          {typeof td.route_number === 'string' && td.route_number.trim() ? (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {td.route_number}
                              {typeof td.session_type === 'string' ? ` · ${td.session_type}` : ''}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-800">{notification.certificate_name}</div>
                          <div className="text-xs text-slate-500">{notification.entity_type}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {trip ? (
                        routeIdOk ? (
                          <Link
                            href={`/dashboard/routes/${routeIdNum}`}
                            className="text-primary hover:text-primary/80 hover:underline flex items-center gap-1 font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>Open route</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-500">Route unavailable</span>
                        )
                      ) : (
                        <Link
                          href={getEntityLink(notification.entity_type, notification.entity_id)}
                          className="text-primary hover:text-primary/80 hover:underline flex items-center gap-1 font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>View {notification.entity_type}</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      {trip ? (
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            {typeof td.parent_name === 'string' && td.parent_name.trim()
                              ? td.parent_name
                              : 'Parent —'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {typeof td.passenger_name === 'string' && td.passenger_name.trim()
                              ? td.passenger_name
                              : 'Passenger —'}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-medium text-slate-800">{notification.recipient?.full_name || 'N/A'}</div>
                          <div className="text-xs text-slate-400">{notification.recipient_email || 'No email'}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">{trip ? null : formatDate(notification.expiry_date)}</TableCell>
                    <TableCell>
                      {trip ? null : (
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
                      )}
                    </TableCell>
                    <TableCell>
                      {trip ? (
                        <div className="text-xs text-slate-400">—</div>
                      ) : notification.admin_response_required && notification.employee_response_type ? (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                              ⚠️ Response Required
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
                        <div className="text-xs text-gray-400">No response yet</div>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (trip && routeIdOk) {
                              console.debug('[fleet] ComplianceNotificationsClient: folder → route', routeIdNum)
                              router.push(`/dashboard/routes/${routeIdNum}`)
                              return
                            }
                            if (!trip) void handleOpenCase(notification.id)
                          }}
                          disabled={openingCase === notification.id}
                          className="text-slate-600 hover:text-primary hover:bg-primary/10 h-8 w-8 p-0"
                          title={trip ? (routeIdOk ? 'Open route' : 'No route link') : 'Open case'}
                        >
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                        {!permissionsLoading && canAdminReviewFocus && (
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              requestToggleUserAdminPin(notification.id)
                            }}
                            className={cn(
                              'h-8 w-8 p-0',
                              userPinned
                                ? 'text-yellow-900 bg-yellow-200 hover:bg-yellow-300'
                                : 'text-slate-500 hover:text-yellow-800 hover:bg-yellow-50'
                            )}
                            title={
                              userPinned
                                ? 'Remove from admin priority (confirm)'
                                : 'Send to admin priority: yellow highlight + top of list (confirm)'
                            }
                            aria-pressed={userPinned}
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </Button>
                        )}
                        {notification.status === 'pending' && notification.recipient_email && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEmailEditor(notification)
                            }}
                            disabled={sendingEmail === notification.id}
                            className="bg-primary hover:bg-primary/90 text-white shadow-sm h-8 w-8 p-0"
                            title="Send Email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {notification.status === 'sent' && notification.recipient_email && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEmailEditor(notification)
                            }}
                            disabled={sendingEmail === notification.id}
                            variant="ghost"
                            className="text-primary hover:text-primary/80 hover:bg-primary/10 h-8 w-8 p-0"
                            title="Resend Email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {notification.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDismiss(notification.id)
                            }}
                            disabled={dismissing === notification.id}
                            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 h-8 w-8 p-0"
                            title="Ignore"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {notification.admin_response_required && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleResolve(notification.id)
                            }}
                            disabled={resolving === notification.id}
                            className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm h-8 w-8 p-0"
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {(notification.status === 'pending' || notification.status === 'sent') && !notification.admin_response_required && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleResolve(notification.id)
                            }}
                            disabled={resolving === notification.id}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 w-8 p-0"
                            title="Mark Resolved"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
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
          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 font-medium">
            ▶ Show resolved/dismissed compliance notifications ({complianceResolved.length})
          </summary>
          <Card className="mt-4 border-slate-200 rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Certificate</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Resolved At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complianceResolved.map((notification) => {
                    const trip = notification.notification_type === 'trip_cancellation'
                    const td =
                      notification.details &&
                      typeof notification.details === 'object' &&
                      !Array.isArray(notification.details)
                        ? (notification.details as Record<string, unknown>)
                        : {}
                    const routeIdRaw = td.route_id
                    const routeIdNum = typeof routeIdRaw === 'number' ? routeIdRaw : Number(routeIdRaw)
                    const routeIdOk = Number.isFinite(routeIdNum) && routeIdNum > 0
                    const daysResolved = daysFromTodayToExpiryDate(notification.expiry_date)
                    const needsAdmin = !!notification.admin_response_required
                    const userPinned = userAdminPinnedIds.has(notification.id)
                    const onResolvedRowClick = () => {
                      if (openingCase === notification.id) return
                      if (trip && routeIdOk) {
                        console.debug('[fleet] ComplianceNotificationsClient: resolved trip row → route', routeIdNum)
                        router.push(`/dashboard/routes/${routeIdNum}`)
                        return
                      }
                      console.debug('[fleet] ComplianceNotificationsClient: resolved row open case', notification.id)
                      void handleOpenCase(notification.id)
                    }
                    return (
                    <TableRow
                      key={notification.id}
                      className={cn(
                        'cursor-pointer hover:bg-slate-50',
                        userPinned &&
                          'z-[1] bg-yellow-100 shadow-[inset_0_0_0_2px_rgba(234,179,8,0.9)] border-l-4 border-yellow-500',
                        !userPinned && needsAdmin && 'bg-amber-50 border-l-4 border-amber-400'
                      )}
                      onClick={onResolvedRowClick}
                      title={trip && routeIdOk ? 'Open route — click row' : 'Open compliance case — click row'}
                    >
                      <TableCell>
                        {getStatusBadge(notification.status, daysResolved)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">
                        {trip
                          ? `Trip · ${typeof td.reason === 'string' && td.reason.trim() ? td.reason : 'cancellation'}`
                          : notification.certificate_name}
                      </TableCell>
                      <TableCell>
                        {trip && routeIdOk ? (
                          <Link
                            href={`/dashboard/routes/${routeIdNum}`}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open route
                          </Link>
                        ) : (
                          <Link
                            href={getEntityLink(notification.entity_type, notification.entity_id)}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View {notification.entity_type}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {trip ? null : formatDate(notification.expiry_date)}
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
                <h2 className="text-xl font-bold text-slate-900">Edit Email</h2>
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
                        <Label htmlFor="hold-on-send" className="text-slate-800">Put on hold until admin clears</Label>
                        <p className="text-xs text-slate-500">
                          Flags the recipient, vehicle, and related routes as ON HOLD after sending.
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
                        <Label htmlFor="include-appointment-link" className="text-slate-800">Include appointment booking link</Label>
                        <p className="text-xs text-slate-500">
                          Adds a link so the recipient can book an available slot.
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
                      You can edit the email content above. The upload link will be automatically included.
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

