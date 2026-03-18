'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { CheckCircle, XCircle, Clock, Car, AlertTriangle, Eye, Wrench, UserX } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import ReplacementVehicleFinder from '@/components/ReplacementVehicleFinder'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: number
  notification_type: string
  entity_type: string
  entity_id: number
  certificate_type: string
  certificate_name: string
  expiry_date: string
  days_until_expiry: number
  recipient_employee_id: number | null
  recipient_email: string | null
  status: 'pending' | 'sent' | 'resolved' | 'dismissed'
  email_sent_at: string | null
  email_token: string
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

interface RouteActivityNotificationsClientProps {
  initialNotifications: Notification[]
}

export function RouteActivityNotificationsClient({ initialNotifications }: RouteActivityNotificationsClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [resolving, setResolving] = useState<number | null>(null)
  const [showReplacementFinder, setShowReplacementFinder] = useState(false)
  const [selectedBreakdownId, setSelectedBreakdownId] = useState<number | null>(null)
  const [approvingTardiness, setApprovingTardiness] = useState<number | null>(null)
  const [decliningTardiness, setDecliningTardiness] = useState<number | null>(null)
  const [tardinessNotes, setTardinessNotes] = useState<{ [key: number]: string }>({})
  const [showTardinessModal, setShowTardinessModal] = useState<number | null>(null)
  const [parentCancellations, setParentCancellations] = useState<any[]>([])
  const [acknowledging, setAcknowledging] = useState<number | null>(null)
  const previousNotificationIds = useRef<Set<number>>(new Set(initialNotifications.map(n => n.id)))
  const audioContextRef = useRef<AudioContext | null>(null)

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

    let title = ''
    let body = ''

    if (notification.notification_type === 'vehicle_breakdown') {
      title = 'Vehicle Breakdown Reported'
      const details = notification.details
      if (details && typeof details === 'object') {
        const vehicleId = details.vehicle_identifier || details.vehicle_id || 'Unknown'
        const routeNum = details.route_number || details.route_id || 'Unknown'
        body = `Vehicle: ${vehicleId} on Route: ${routeNum}`
      } else {
        body = 'A vehicle breakdown has been reported'
      }
    } else if (notification.notification_type === 'driver_tardiness') {
      title = 'Driver Tardiness Reported'
      const details = notification.details
      if (details && typeof details === 'object') {
        const driverName = details.driver_name || 'Unknown Driver'
        const routeNum = details.route_number || details.route_id || 'Unknown'
        const reason = details.reason || 'No reason provided'
        body = `${driverName} - Route: ${routeNum} - ${reason}`
      } else {
        body = 'A driver tardiness report has been submitted'
      }
    } else {
      title = 'New Route Activity Notification'
      body = 'New route activity notification received'
    }

    new Notification(title, {
      body: body.substring(0, 150),
      icon: '/favicon.ico',
      tag: `route-activity-${notification.id}`,
      requireInteraction: false
    })
  }

  // Fetch notifications function
  const fetchNotifications = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        recipient:recipient_employee_id(full_name, personal_email)
      `)
      .in('notification_type', ['vehicle_breakdown', 'driver_tardiness'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      // Parse details JSONB field if it exists
      data.forEach((notification: any) => {
        if (notification.details && typeof notification.details === 'string') {
          try {
            notification.details = JSON.parse(notification.details)
          } catch (e) {
            // Keep as is if not valid JSON
          }
        }
      })

      // Check for new notifications
      const currentIds = new Set(data.map((n: Notification) => n.id))
      const newNotifications = data.filter((n: Notification) => !previousNotificationIds.current.has(n.id))

      if (newNotifications.length > 0) {
        // Play sound for new notifications
        playNotificationSound()

        // Show browser notification for each new notification
        newNotifications.forEach(notification => {
          showBrowserNotification(notification)
        })
      }

      previousNotificationIds.current = currentIds
      setNotifications(data)
    }
  }

  // Fetch parent cancellations
  const fetchParentCancellations = async () => {
    try {
      const supabase = createClient()

      // Fetch all parent absence reports (both acknowledged and unacknowledged)
      // Show unacknowledged first, then acknowledged
      const { data: reports, error: reportsError } = await supabase
        .from('parent_absence_reports')
        .select('*')
        .order('acknowledged_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
        .limit(100)

      if (reportsError) {
        console.error('Error fetching parent cancellations:', reportsError)
        setParentCancellations([])
        return
      }

      if (!reports || reports.length === 0) {
        setParentCancellations([])
        return
      }

      // Fetch passenger details for each report
      // Convert to numbers to ensure type matching
      const passengerIds = Array.from(new Set(reports.map((r: any) => parseInt(r.passenger_id)).filter((id: any) => !isNaN(id) && id > 0)))
      const routeIds = Array.from(new Set(reports.map((r: any) => parseInt(r.route_id)).filter((id: any) => !isNaN(id) && id > 0)))
      const sessionIds = Array.from(new Set(reports.map((r: any) => parseInt(r.route_session_id || r.session_id)).filter((id: any) => !isNaN(id) && id > 0)))

      // Get reported_by_email emails (could be email strings)
      // Clean and normalize emails: trim whitespace and convert to lowercase
      const reportedByEmails = Array.from(new Set(
        reports
          .map((r: any) => r.reported_by_email || r.reported_by)
          .filter((email: any) => email && typeof email === 'string')
          .map((email: string) => email.trim().toLowerCase())
      ))

      // Get acknowledged_by user IDs
      const acknowledgedByUserIds = Array.from(new Set(
        reports
          .map((r: any) => parseInt(r.acknowledged_by))
          .filter((id: any) => !isNaN(id) && id > 0)
      ))

      console.log('Fetching passengers for IDs:', passengerIds)
      console.log('Fetching routes for IDs:', routeIds)
      console.log('Fetching sessions for IDs:', sessionIds)
      console.log('Fetching parent contacts for emails:', reportedByEmails)
      console.log('Fetching users for acknowledged_by IDs:', acknowledgedByUserIds)

      // Fetch parent contacts by email (reported_by field)
      // Query parent_contacts where email matches any reported_by email (case-insensitive)
      let parentContactsByEmail: any[] = []
      if (reportedByEmails.length > 0) {
        // Use ilike for case-insensitive matching, or query all and filter
        // Since Supabase .in() is case-sensitive, we'll fetch and match manually
        const { data: allParentContacts, error: parentContactsError } = await supabase
          .from('parent_contacts')
          .select('id, full_name, phone_number, email')

        if (parentContactsError) {
          console.error('Error fetching parent contacts:', parentContactsError)
        } else if (allParentContacts) {
          // Filter parent contacts where email (lowercase) matches any reported_by email
          parentContactsByEmail = allParentContacts.filter((pc: any) =>
            pc.email && reportedByEmails.includes(pc.email.trim().toLowerCase())
          )
          console.log('Parent contacts matched by email:', parentContactsByEmail.length)
        }
      }

      const [passengersResult, routesResult, sessionsResult, usersResult] = await Promise.all([
        passengerIds.length > 0
          ? supabase
            .from('passengers')
            .select('id, full_name, address, route_id')
            .in('id', passengerIds)
          : Promise.resolve({ data: [], error: null }),
        routeIds.length > 0
          ? supabase
            .from('routes')
            .select('id, route_number, school_id')
            .in('id', routeIds)
          : Promise.resolve({ data: [], error: null }),
        sessionIds.length > 0
          ? supabase
            .from('route_sessions')
            .select('id, session_date, session_type, route_id')
            .in('id', sessionIds)
          : Promise.resolve({ data: [], error: null }),
        acknowledgedByUserIds.length > 0
          ? supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', acknowledgedByUserIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (passengersResult.error) {
        console.error('Error fetching passengers:', passengersResult.error)
      }
      if (routesResult.error) {
        console.error('Error fetching routes:', routesResult.error)
      }
      if (sessionsResult.error) {
        console.error('Error fetching sessions:', sessionsResult.error)
      }
      if (usersResult.error) {
        console.error('Error fetching users:', usersResult.error)
      }

      // Create lookup maps (ensure IDs are numbers for matching)
      const passengersMap = new Map(
        (passengersResult.data || []).map((p: any) => [parseInt(p.id), p])
      )
      const routesMap = new Map(
        (routesResult.data || []).map((r: any) => [parseInt(r.id), r])
      )
      const sessionsMap = new Map(
        (sessionsResult.data || []).map((s: any) => [parseInt(s.id), s])
      )
      // Create users map for acknowledged_by
      const usersMap = new Map(
        (usersResult.data || []).map((u: any) => [parseInt(u.id), u])
      )
      // Create parent contacts map by email (case-insensitive)
      const parentContactsByEmailMap = new Map(
        parentContactsByEmail
          .filter((pc: any) => pc.email) // Only include contacts with email
          .map((pc: any) => [pc.email.toLowerCase().trim(), pc])
      )

      console.log('Parent contacts found by email:', parentContactsByEmail.length)
      console.log('Parent contacts map entries:', Array.from(parentContactsByEmailMap.keys()))

      // Get additional route IDs from passengers and sessions (in case route_id is null in absence report)
      const passengerRouteIds = Array.from(new Set(
        (passengersResult.data || [])
          .map((p: any) => parseInt(p.route_id))
          .filter((id: any) => !isNaN(id) && id > 0 && !routeIds.includes(id))
      ))

      // Get route IDs from sessions
      const sessionRouteIds = Array.from(new Set(
        (sessionsResult.data || [])
          .map((s: any) => parseInt(s.route_id))
          .filter((id: any) => !isNaN(id) && id > 0 && !routeIds.includes(id) && !passengerRouteIds.includes(id))
      ))

      // Fetch additional routes from passenger route_ids and session route_ids
      const allAdditionalRouteIds = Array.from(new Set([...passengerRouteIds, ...sessionRouteIds]))
      if (allAdditionalRouteIds.length > 0) {
        console.log('Fetching additional routes from passengers and sessions:', allAdditionalRouteIds)
        const additionalRoutesResult = await supabase
          .from('routes')
          .select('id, route_number, school_id')
          .in('id', allAdditionalRouteIds)

        if (additionalRoutesResult.data) {
          additionalRoutesResult.data.forEach((r: any) => {
            routesMap.set(parseInt(r.id), r)
          })
        }
      }

      // Enrich reports with passenger, route, session, parent contact, and acknowledged_by user details
      const enrichedReports = reports.map((report: any) => {
        const passengerId = parseInt(report.passenger_id)
        const routeId = parseInt(report.route_id)
        const sessionId = parseInt(report.route_session_id || report.session_id)
        const acknowledgedById = parseInt(report.acknowledged_by)

        const passenger = (!isNaN(passengerId) && passengerId > 0) ? (passengersMap.get(passengerId) || null) : null
        const session = (!isNaN(sessionId) && sessionId > 0) ? (sessionsMap.get(sessionId) || null) : null
        const acknowledgedByUser = (!isNaN(acknowledgedById) && acknowledgedById > 0) ? (usersMap.get(acknowledgedById) || null) : null

        // Get parent contact by matching reported_by_email
        const reportedByEmail = report.reported_by_email || report.reported_by
        const parentContact = reportedByEmail && typeof reportedByEmail === 'string'
          ? (parentContactsByEmailMap.get(reportedByEmail.trim().toLowerCase()) || null)
          : null

        // Try to get route from report first, then from session, then from passenger's route_id
        let route = (!isNaN(routeId) && routeId > 0) ? (routesMap.get(routeId) || null) : null
        if (!route && session && session.route_id) {
          const sessionRouteId = parseInt(session.route_id)
          if (!isNaN(sessionRouteId) && sessionRouteId > 0) {
            route = routesMap.get(sessionRouteId) || null
          }
        }
        if (!route && passenger && passenger.route_id) {
          const passengerRouteId = parseInt(passenger.route_id)
          if (!isNaN(passengerRouteId) && passengerRouteId > 0) {
            route = routesMap.get(passengerRouteId) || null
          }
        }

        return {
          ...report,
          passenger,
          route,
          route_session: session,
          parent_contact: parentContact,
          acknowledged_by_user: acknowledgedByUser,
        }
      })

      console.log('Parent cancellations fetched:', enrichedReports.length, 'records')
      console.log('Sample cancellation data:', enrichedReports[0])
      console.log('Passengers found:', passengersMap.size, 'out of', passengerIds.length)
      console.log('Routes found:', routesMap.size, 'out of', routeIds.length)
      setParentCancellations(enrichedReports)
    } catch (err) {
      console.error('Exception fetching parent cancellations:', err)
      setParentCancellations([])
    }
  }

  // Auto-refresh every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications()
      fetchParentCancellations()
    }, 20000) // 20 seconds

    return () => clearInterval(interval)
  }, [])

  // Real-time subscription for notifications
  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    fetchNotifications()
    fetchParentCancellations()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('route_activity_notifications_realtime_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: 'notification_type=in.(vehicle_breakdown,driver_tardiness)'
        },
        (payload) => {
          console.log('Route activity notification change detected:', payload.eventType)
          fetchNotifications()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parent_absence_reports'
        },
        (payload) => {
          console.log('Parent absence report change detected:', payload.eventType)
          fetchParentCancellations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, status: 'resolved' as const, resolved_at: new Date().toISOString(), admin_response_required: false }
            : n
        )
      )

      window.dispatchEvent(new CustomEvent('notificationResolved'))
    } catch (error: any) {
      alert('Error resolving notification: ' + error.message)
    } finally {
      setResolving(null)
    }
  }

  const handleAcknowledgeCancellation = async (cancellationId: number) => {
    console.log('Acknowledging cancellation ID:', cancellationId)
    setAcknowledging(cancellationId)
    try {
      const supabase = createClient()

      // Verify we have a valid cancellation ID
      if (!cancellationId || isNaN(cancellationId)) {
        throw new Error('Invalid cancellation ID')
      }

      // Get current user ID
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        throw new Error('You must be logged in to acknowledge cancellations')
      }

      // Get user ID from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()

      if (!userData || !userData.id) {
        throw new Error('Unable to identify current user')
      }

      console.log('Updating parent_absence_reports with ID:', cancellationId, 'acknowledged_by:', userData.id)

      // Update the parent_absence_reports record to mark as acknowledged
      // Update acknowledged_at timestamp, status to 'acknowledged', and acknowledged_by user ID
      const { data, error } = await supabase
        .from('parent_absence_reports')
        .update({
          acknowledged_at: new Date().toISOString(),
          status: 'acknowledged',
          acknowledged_by: userData.id
        })
        .eq('id', cancellationId)
        .select()

      console.log('Update response - data:', data, 'error:', error)

      if (error) {
        console.error('Supabase update error:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      if (!data || data.length === 0) {
        console.warn('Update succeeded but no rows were updated. Cancellation ID:', cancellationId)
      } else {
        console.log('Successfully acknowledged cancellation:', data[0])
      }

      // Update the local state to reflect the acknowledgment
      setParentCancellations(prev =>
        prev.map(c =>
          c.id === cancellationId
            ? {
              ...c,
              acknowledged_at: new Date().toISOString(),
              status: 'acknowledged',
              acknowledged_by: userData.id,
              acknowledged_by_user: { id: userData.id, full_name: authUser.user_metadata?.full_name || authUser.email || 'Unknown', email: authUser.email || '' }
            }
            : c
        )
      )

      // Refresh the list to get updated data
      await fetchParentCancellations()
    } catch (error: any) {
      console.error('Error acknowledging cancellation:', error)
      console.error('Error stack:', error.stack)
      const errorMessage = error?.message || error?.details || 'Unknown error occurred'
      alert('Error acknowledging cancellation: ' + errorMessage)
    } finally {
      setAcknowledging(null)
    }
  }

  const handleFindReplacement = (notification: Notification) => {
    const breakdownId = notification.details?.breakdown_id
    if (breakdownId) {
      setSelectedBreakdownId(breakdownId)
      setShowReplacementFinder(true)
    }
  }

  const handleReplacementAssigned = () => {
    setShowReplacementFinder(false)
    setSelectedBreakdownId(null)
    window.location.reload()
  }

  const handleApproveTardiness = async (notification: Notification) => {
    const tardinessReportId = parseInt(notification.certificate_type)
    if (!tardinessReportId) return

    setApprovingTardiness(notification.id)
    try {
      const response = await fetch('/api/tardiness/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tardinessReportId,
          coordinatorNotes: tardinessNotes[notification.id] || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve tardiness report')
      }

      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id
            ? { ...n, status: 'resolved' as const, resolved_at: new Date().toISOString() }
            : n
        )
      )

      setTardinessNotes(prev => {
        const updated = { ...prev }
        delete updated[notification.id]
        return updated
      })
      setShowTardinessModal(null)

      window.dispatchEvent(new CustomEvent('notificationResolved'))
    } catch (error: any) {
      alert('Error approving tardiness: ' + error.message)
    } finally {
      setApprovingTardiness(null)
    }
  }

  const handleDeclineTardiness = async (notification: Notification) => {
    const tardinessReportId = parseInt(notification.certificate_type)
    if (!tardinessReportId) return

    setDecliningTardiness(notification.id)
    try {
      const response = await fetch('/api/tardiness/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tardinessReportId,
          coordinatorNotes: tardinessNotes[notification.id] || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to decline tardiness report')
      }

      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id
            ? { ...n, status: 'resolved' as const, resolved_at: new Date().toISOString() }
            : n
        )
      )

      setTardinessNotes(prev => {
        const updated = { ...prev }
        delete updated[notification.id]
        return updated
      })
      setShowTardinessModal(null)

      window.dispatchEvent(new CustomEvent('notificationResolved'))
    } catch (error: any) {
      alert('Error declining tardiness: ' + error.message)
    } finally {
      setDecliningTardiness(null)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'resolved') {
      return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700">Resolved</span>
    }
    if (status === 'dismissed') {
      return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600">Dismissed</span>
    }
    return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700">Pending</span>
  }

  const breakdownNotifications = notifications.filter(n =>
    n.notification_type === 'vehicle_breakdown' &&
    n.status !== 'resolved' &&
    n.status !== 'dismissed'
  )
  const tardinessNotifications = notifications.filter(n =>
    n.notification_type === 'driver_tardiness' &&
    n.status !== 'resolved' &&
    n.status !== 'dismissed'
  )
  const routeActivityResolved = notifications.filter(n =>
    (n.notification_type === 'vehicle_breakdown' || n.notification_type === 'driver_tardiness') &&
    (n.status === 'resolved' || n.status === 'dismissed')
  )

  return (
    <div className="space-y-6">
      {/* Breakdown Notifications - Clean Table */}
      {breakdownNotifications.length > 0 && (
        <Card className="border-slate-200 overflow-hidden rounded-2xl">
          <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Vehicle Breakdowns</h2>
            <span className="px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-sm font-semibold border border-rose-100">
              {breakdownNotifications.length} Active
            </span>
          </div>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdownNotifications.map((notification) => {
                  const details = notification.details || {}
                  return (
                    <TableRow key={notification.id} className="hover:bg-slate-50">
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                          <AlertTriangle className="h-3 w-3" />
                          URGENT
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/vehicles/${notification.entity_id}`} className="font-medium text-slate-900 hover:text-violet-600">
                          Vehicle {notification.entity_id}
                        </Link>
                        <div className="text-xs text-slate-500">{details.location || 'No location'}</div>
                      </TableCell>
                      <TableCell>
                        {details.route_id ? (
                          <Link href={`/dashboard/routes/${details.route_id}`} className="text-sm text-slate-600 hover:text-violet-600 hover:underline">
                            Route {details.route_number || details.route_id}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700 line-clamp-2" title={details.description}>
                          {details.description || 'No description provided'}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {formatDateTime(details.reported_at || notification.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleFindReplacement(notification)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50"
                            title="Find Replacement Vehicle"
                          >
                            <Car className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResolve(notification.id)}
                            disabled={resolving === notification.id}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            title={resolving === notification.id ? 'Resolving...' : 'Resolve Breakdown'}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
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

      {/* Tardiness Notifications - Clean Table */}
      {tardinessNotifications.length > 0 && (
        <Card className="border-slate-200 overflow-hidden rounded-2xl">
          <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Driver Tardiness</h2>
            <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-semibold border border-amber-100">
              {tardinessNotifications.length} Pending
            </span>
          </div>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tardinessNotifications.map((notification) => {
                  const details = notification.details || {}
                  return (
                    <TableRow key={notification.id} className="hover:bg-slate-50">
                      <TableCell>
                        <Link href={`/dashboard/drivers/${notification.entity_id}`} className="font-medium text-slate-900 hover:text-violet-600">
                          {details.driver_name || 'Unknown Driver'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {details.route_id ? (
                          <Link href={`/dashboard/routes/${details.route_id}`} className="text-sm text-slate-600 hover:text-violet-600 hover:underline">
                            Route {details.route_number || details.route_id}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">{details.route_number || 'N/A'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-700">
                          {details.session_type || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500">{formatDate(notification.expiry_date)}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700">
                          {notification.certificate_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {details.reported_at ? formatDateTime(details.reported_at) : formatDateTime(notification.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {showTardinessModal === notification.id ? (
                          <div className="absolute right-4 mt-2 z-10 bg-white shadow-xl border border-slate-200 rounded-lg p-3 w-64">
                            <textarea
                              rows={2}
                              value={tardinessNotes[notification.id] || ''}
                              onChange={(e) => setTardinessNotes(prev => ({ ...prev, [notification.id]: e.target.value }))}
                              placeholder="Add notes..."
                              className="w-full text-sm border rounded p-2 mb-2 focus:ring-2 focus:ring-violet-500 outline-none"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowTardinessModal(null)}
                                className="h-7 px-2 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleDeclineTardiness(notification)}
                                disabled={decliningTardiness === notification.id}
                                className="h-7 px-2 text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 hover:text-rose-800"
                              >
                                Decline
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApproveTardiness(notification)}
                                disabled={approvingTardiness === notification.id}
                                className="h-7 px-2 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800"
                              >
                                Approve
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowTardinessModal(notification.id)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50"
                            title="Review Report"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Parent Cancellations - Clean Table */}
      {parentCancellations && parentCancellations.length > 0 && (
        <Card className="border-slate-200 overflow-hidden rounded-2xl">
          <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Parent Cancellations</h2>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold border border-blue-100">
              {parentCancellations.length} Active
            </span>
          </div>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Parent/Guardian</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Session / Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parentCancellations.map((cancellation: any) => {
                  // Get passenger, route, session, and parent contact from enriched data
                  const passenger = cancellation.passenger
                  const route = cancellation.route
                  const session = cancellation.route_session
                  const parentContact = cancellation.parent_contact

                  // Determine route ID for link (use route_id from report, session, or passenger's route_id)
                  const routeIdForLink = cancellation.route_id
                    || (session?.route_id ? parseInt(session.route_id) : null)
                    || (passenger?.route_id ? parseInt(passenger.route_id) : null)

                  const absenceDate = session?.session_date
                    || cancellation.absence_date
                    || cancellation.session_date

                  return (
                    <TableRow key={cancellation.id} className="hover:bg-slate-50">
                      <TableCell>
                        {passenger && passenger.full_name ? (
                          <Link
                            href={`/dashboard/passengers/${cancellation.passenger_id}`}
                            className="font-medium text-slate-900 hover:text-navy hover:underline text-sm"
                          >
                            {passenger.full_name}
                          </Link>
                        ) : cancellation.passenger_id ? (
                          <span className="text-slate-400 text-sm">ID: {cancellation.passenger_id}</span>
                        ) : (
                          <span className="text-slate-400 text-sm">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {parentContact && parentContact.full_name ? (
                          <div>
                            <Link
                              href={`/dashboard/parent-contacts/${parentContact.id}`}
                              className="text-sm font-medium text-slate-900 hover:text-navy hover:underline"
                            >
                              {parentContact.full_name}
                            </Link>
                            {parentContact.phone_number && (
                              <div className="text-xs text-slate-500">{parentContact.phone_number}</div>
                            )}
                          </div>
                        ) : cancellation.reported_by_email || cancellation.reported_by ? (
                          <span className="text-slate-500 text-sm truncate max-w-[120px] block">{cancellation.reported_by_email || cancellation.reported_by}</span>
                        ) : (
                          <span className="text-slate-400 text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {route && route.route_number ? (
                          <Link
                            href={`/dashboard/routes/${routeIdForLink || route.id}`}
                            className="text-sm text-slate-600 hover:text-navy hover:underline"
                          >
                            {route.route_number}
                          </Link>
                        ) : routeIdForLink ? (
                          <Link
                            href={`/dashboard/routes/${routeIdForLink}`}
                            className="text-sm text-slate-600 hover:text-navy hover:underline"
                          >
                            #{routeIdForLink}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-700">
                          {session?.session_type || cancellation.session_type || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {absenceDate ? formatDate(absenceDate) : '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700 line-clamp-2 max-w-[150px]" title={cancellation.reason || cancellation.notes}>
                          {cancellation.reason || cancellation.notes || 'No reason'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {cancellation.acknowledged_by_user ? (
                          <div className="text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                              <CheckCircle className="h-3 w-3" />
                              Ack
                            </span>
                            <div className="text-slate-500 mt-1 truncate max-w-[100px]">
                              {cancellation.acknowledged_by_user.full_name || 'User'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                              <Clock className="h-3 w-3" />
                              Pending
                            </span>
                            <div className="text-slate-400 mt-1">
                              {formatDate(cancellation.created_at || cancellation.reported_at)}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {cancellation.acknowledged_at ? (
                          <span className="text-xs text-slate-400">Done</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAcknowledgeCancellation(cancellation.id)}
                            disabled={acknowledging === cancellation.id}
                            className="h-7 px-2 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            title="Mark as Acknowledged"
                          >
                            {acknowledging === cancellation.id ? (
                              '...'
                            ) : (
                              <>
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Ack
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {breakdownNotifications.length === 0 && tardinessNotifications.length === 0 && parentCancellations.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No pending route activity</p>
            <p className="text-sm text-slate-400">Everything is running smoothly</p>
          </CardContent>
        </Card>
      ) : null}

      {routeActivityResolved.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 font-medium">
            ▶ Show resolved/dismissed activity ({routeActivityResolved.length})
          </summary>
          <Card className="mt-4 border-slate-200 rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Resolved At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routeActivityResolved.map((notification) => (
                    <TableRow key={notification.id} className="hover:bg-slate-50">
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${notification.notification_type === 'vehicle_breakdown' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                          {notification.notification_type === 'vehicle_breakdown' ? <Wrench className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {notification.notification_type === 'vehicle_breakdown' ? 'Breakdown' : 'Tardiness'}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(notification.status)}</TableCell>
                      <TableCell>
                        {notification.notification_type === 'vehicle_breakdown' ? (
                          <Link href={`/dashboard/vehicles/${notification.entity_id}`} className="text-slate-700 hover:text-violet-600 hover:underline font-medium">
                            Vehicle {notification.entity_id}
                          </Link>
                        ) : (
                          <Link href={`/dashboard/drivers/${notification.entity_id}`} className="text-slate-700 hover:text-violet-600 hover:underline font-medium">
                            Driver {notification.entity_id}
                          </Link>
                        )}
                        {notification.details?.route_id && (
                          <span className="ml-2 text-slate-500">
                            {' • '}
                            <Link href={`/dashboard/routes/${notification.details.route_id}`} className="hover:text-violet-600 hover:underline">
                              Route {notification.details.route_number || notification.details.route_id}
                            </Link>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {notification.resolved_at ? formatDateTime(notification.resolved_at) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </details>
      )}

      {/* Replacement Vehicle Finder Modal */}
      {showReplacementFinder && selectedBreakdownId && (
        <ReplacementVehicleFinder
          breakdownId={selectedBreakdownId}
          onClose={() => {
            setShowReplacementFinder(false)
            setSelectedBreakdownId(null)
          }}
          onAssign={handleReplacementAssigned}
        />
      )}
    </div>
  )
}

