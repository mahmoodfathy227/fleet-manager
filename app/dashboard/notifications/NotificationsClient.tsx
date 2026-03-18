'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Mail, CheckCircle, XCircle, AlertTriangle, Clock, ExternalLink, CheckCircle2, X, Car, Wrench, Clock as ClockIcon } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
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

interface NotificationsClientProps {
  initialNotifications: Notification[]
}

type NotificationTab = 'compliance' | 'route-activity'

export function NotificationsClient({ initialNotifications }: NotificationsClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [activeTab, setActiveTab] = useState<NotificationTab>('compliance')
  const [sendingEmail, setSendingEmail] = useState<number | null>(null)
  const [dismissing, setDismissing] = useState<number | null>(null)
  const [resolving, setResolving] = useState<number | null>(null)
  const [emailEditorOpen, setEmailEditorOpen] = useState(false)
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null)
  const [showReplacementFinder, setShowReplacementFinder] = useState(false)
  const [selectedBreakdownId, setSelectedBreakdownId] = useState<number | null>(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [holdOnSend, setHoldOnSend] = useState(true)
  const [includeAppointmentLink, setIncludeAppointmentLink] = useState(true)
  const [approvingTardiness, setApprovingTardiness] = useState<number | null>(null)
  const [decliningTardiness, setDecliningTardiness] = useState<number | null>(null)
  const [tardinessNotes, setTardinessNotes] = useState<{ [key: number]: string }>({})
  const [showTardinessModal, setShowTardinessModal] = useState<number | null>(null)

  // Real-time subscription for notifications
  useEffect(() => {
    const supabase = createClient()

    // Fetch updated notifications when changes occur
    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          recipient:recipient_employee_id(full_name, personal_email)
        `)
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
        setNotifications(data)
      }
    }

    // Initial fetch
    fetchNotifications()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('notifications_realtime_channel')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          console.log('Notification change detected:', payload.eventType)
          // Refetch notifications when any change occurs
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleOpenEmailEditor = async (notification: Notification) => {
    setEditingNotification(notification)
    setLoadingTemplate(true)
    setEmailEditorOpen(true)
    setHoldOnSend(true)
    setIncludeAppointmentLink(true)

    try {
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

      if (data.emailTemplate) {
        setEmailSubject(data.emailTemplate.subject)
        setEmailBody(data.emailTemplate.body)
      }
    } catch (error: any) {
      alert('Error loading email template: ' + error.message)
      setEmailEditorOpen(false)
    } finally {
      setLoadingTemplate(false)
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
          includeAppointmentLink,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      // Update notification status
      setNotifications(prev =>
        prev.map(n =>
          n.id === editingNotification.id
            ? { ...n, status: 'sent' as const, email_sent_at: new Date().toISOString() }
            : n
        )
      )

      // Close editor
      setEmailEditorOpen(false)
      setEditingNotification(null)
      setEmailSubject('')
      setEmailBody('')

      // In development, show email content
      if (data.emailContent && process.env.NODE_ENV === 'development') {
        alert(`Email sent! (Dev mode)\n\nTo: ${data.emailContent.to}\nSubject: ${data.emailContent.subject}`)
      } else {
        alert('Email sent successfully!')
      }
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

      // Update local state immediately
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, status: 'dismissed' as const } : n
        )
      )

      // Trigger a custom event to refresh the notification count in the sidebar
      // This ensures the badge updates immediately
      window.dispatchEvent(new CustomEvent('notificationResolved'))
    } catch (error: any) {
      alert('Error dismissing notification: ' + error.message)
    } finally {
      setDismissing(null)
    }
  }

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

      // Update local state immediately
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId 
            ? { ...n, status: 'resolved' as const, resolved_at: new Date().toISOString(), admin_response_required: false } 
            : n
        )
      )

      // Trigger a custom event to refresh the notification count in the sidebar
      // This ensures the badge updates immediately
      window.dispatchEvent(new CustomEvent('notificationResolved'))
    } catch (error: any) {
      alert('Error resolving notification: ' + error.message)
    } finally {
      setResolving(null)
    }
  }

  const getStatusIcon = (status: string, daysUntil: number) => {
    if (status === 'resolved' || status === 'dismissed') {
      return <CheckCircle className="h-5 w-5 text-gray-400" />
    }
    if (daysUntil < 0) {
      return <XCircle className="h-5 w-5 text-red-500" />
    }
    if (daysUntil <= 7) {
      return <AlertTriangle className="h-5 w-5 text-orange-500" />
    }
    return <Clock className="h-5 w-5 text-yellow-500" />
  }

  const getStatusBadge = (status: string, daysUntil: number) => {
    if (status === 'resolved') {
      return <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-green-100 text-green-800">Resolved</span>
    }
    if (status === 'dismissed') {
      return <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800">Dismissed</span>
    }
    if (status === 'sent') {
      return <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800">Email Sent</span>
    }
    if (daysUntil < 0) {
      return <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-red-100 text-red-800">Expired</span>
    }
    if (daysUntil <= 7) {
      return <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-800">Urgent</span>
    }
    return <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800">Pending</span>
  }

  const getEntityLink = (entityType: string, entityId: number) => {
    if (entityType === 'vehicle') {
      return `/dashboard/vehicles/${entityId}`
    }
    if (entityType === 'driver' || entityType === 'assistant') {
      return `/dashboard/employees/${entityId}`
    }
    return '#'
  }

  // Route Activity Notifications (breakdowns, tardiness)
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
  const routeActivityNotifications = notifications.filter(n =>
    (n.notification_type === 'vehicle_breakdown' || n.notification_type === 'driver_tardiness') &&
    n.status !== 'resolved' &&
    n.status !== 'dismissed'
  )
  const routeActivityResolved = notifications.filter(n =>
    (n.notification_type === 'vehicle_breakdown' || n.notification_type === 'driver_tardiness') &&
    (n.status === 'resolved' || n.status === 'dismissed')
  )

  // Compliance Notifications (certificate expiry)
  const complianceNotifications = notifications.filter(n => 
    n.notification_type !== 'vehicle_breakdown' &&
    n.notification_type !== 'driver_tardiness' &&
    n.status !== 'resolved' && 
    n.status !== 'dismissed'
  )
  const complianceResolved = notifications.filter(n => 
    n.notification_type !== 'vehicle_breakdown' &&
    n.notification_type !== 'driver_tardiness' &&
    (n.status === 'resolved' || n.status === 'dismissed')
  )

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
    // Refresh notifications
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

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id
            ? { ...n, status: 'resolved' as const, resolved_at: new Date().toISOString() }
            : n
        )
      )

      // Clear notes
      setTardinessNotes(prev => {
        const updated = { ...prev }
        delete updated[notification.id]
        return updated
      })
      setShowTardinessModal(null)

      // Trigger notification refresh
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

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id
            ? { ...n, status: 'resolved' as const, resolved_at: new Date().toISOString() }
            : n
        )
      )

      // Clear notes
      setTardinessNotes(prev => {
        const updated = { ...prev }
        delete updated[notification.id]
        return updated
      })
      setShowTardinessModal(null)

      // Trigger notification refresh
      window.dispatchEvent(new CustomEvent('notificationResolved'))
    } catch (error: any) {
      alert('Error declining tardiness: ' + error.message)
    } finally {
      setDecliningTardiness(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Notification sections">
          <button
            onClick={() => setActiveTab('compliance')}
            className={`
              border-b-2 px-1 py-4 text-sm font-medium transition-colors
              ${activeTab === 'compliance' 
                ? 'border-navy text-navy' 
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
            `}
          >
            📜 Compliance ({complianceNotifications.length})
          </button>
          <button
            onClick={() => setActiveTab('route-activity')}
            className={`
              border-b-2 px-1 py-4 text-sm font-medium transition-colors
              ${activeTab === 'route-activity' 
                ? 'border-navy text-navy' 
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
            `}
          >
            🚗 Route Activity ({routeActivityNotifications.length})
          </button>
        </nav>
      </div>

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {complianceNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No pending compliance notifications</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Certificate</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Days Until</TableHead>
                      <TableHead>Employee Response</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complianceNotifications.map((notification) => (
                      <TableRow 
                        key={notification.id}
                        className={notification.admin_response_required ? 'bg-orange-50 border-l-4 border-orange-500' : ''}
                      >
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(notification.status, notification.days_until_expiry)}
                            {getStatusBadge(notification.status, notification.days_until_expiry)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{notification.certificate_name}</div>
                            <div className="text-sm text-gray-500">{notification.entity_type}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={getEntityLink(notification.entity_type, notification.entity_id)}
                            className="text-blue-600 hover:underline flex items-center space-x-1"
                          >
                            <span>View {notification.entity_type}</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">{notification.recipient?.full_name || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{notification.recipient_email || 'No email'}</div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(notification.expiry_date)}</TableCell>
                        <TableCell>
                          <span className={notification.days_until_expiry < 0 ? 'text-red-600 font-semibold' : notification.days_until_expiry <= 7 ? 'text-orange-600 font-semibold' : ''}>
                            {notification.days_until_expiry < 0
                              ? `Expired ${Math.abs(notification.days_until_expiry)} days ago`
                              : `${notification.days_until_expiry} days`}
                          </span>
                        </TableCell>
                        <TableCell>
                          {notification.admin_response_required && notification.employee_response_type ? (
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
                        <TableCell>
                          <div className="flex items-center space-x-2 flex-wrap gap-2">
                            {notification.status === 'pending' && notification.recipient_email && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenEmailEditor(notification)}
                                disabled={sendingEmail === notification.id}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                Send Email
                              </Button>
                            )}
                            {notification.status === 'sent' && notification.recipient_email && (
                              <>
                                <span className="text-sm text-gray-500">
                                  Sent {notification.email_sent_at ? formatDateTime(notification.email_sent_at) : ''}
                                </span>
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenEmailEditor(notification)}
                                  disabled={sendingEmail === notification.id}
                                  variant="secondary"
                                >
                                  <Mail className="h-4 w-4 mr-1" />
                                  Resend Email
                                </Button>
                              </>
                            )}
                            {notification.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleDismiss(notification.id)}
                                disabled={dismissing === notification.id}
                              >
                                {dismissing === notification.id ? 'Dismissing...' : 'Ignore'}
                              </Button>
                            )}
                            {notification.admin_response_required && (
                              <Button
                                size="sm"
                                onClick={() => handleResolve(notification.id)}
                                disabled={resolving === notification.id}
                                className="bg-orange-600 hover:bg-orange-700 text-white"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {resolving === notification.id ? 'Resolving...' : 'Approve & Resolve'}
                              </Button>
                            )}
                            {(notification.status === 'pending' || notification.status === 'sent') && !notification.admin_response_required && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleResolve(notification.id)}
                                disabled={resolving === notification.id}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                {resolving === notification.id ? 'Resolving...' : 'Mark Resolved'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {complianceResolved.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                Show resolved/dismissed compliance notifications ({complianceResolved.length})
              </summary>
              <Card className="mt-4">
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
                      {complianceResolved.map((notification) => (
                        <TableRow key={notification.id}>
                          <TableCell>{getStatusBadge(notification.status, notification.days_until_expiry)}</TableCell>
                          <TableCell>{notification.certificate_name}</TableCell>
                          <TableCell>
                            <Link
                              href={getEntityLink(notification.entity_type, notification.entity_id)}
                              className="text-blue-600 hover:underline"
                            >
                              View {notification.entity_type}
                            </Link>
                          </TableCell>
                          <TableCell>{formatDate(notification.expiry_date)}</TableCell>
                          <TableCell>
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
        </div>
      )}

      {/* Route Activity Tab */}
      {activeTab === 'route-activity' && (
        <div className="space-y-6">
          {/* Breakdown Notifications - Urgent Red Banner */}
          {breakdownNotifications.length > 0 && (
        <Card className="border-2 border-red-500">
          <CardContent className="p-0">
            <div className="bg-red-600 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wrench className="h-5 w-5" />
                  <h2 className="text-lg font-bold">🚨 URGENT: Vehicle Breakdowns</h2>
                </div>
                <span className="px-3 py-1 bg-red-700 rounded-full text-sm font-semibold">
                  {breakdownNotifications.length} Active
                </span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {breakdownNotifications.map((notification) => {
                const details = notification.details || {}
                return (
                  <div
                    key={notification.id}
                    className="p-4 bg-red-50 border-2 border-red-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-red-900">Vehicle Breakdown Reported</h3>
                          <span className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded">
                            URGENT
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p><strong>Vehicle:</strong> <Link href={`/dashboard/vehicles/${notification.entity_id}`} className="text-navy hover:underline">{notification.entity_id}</Link></p>
                          {details.route_id && (
                            <p><strong>Route:</strong> <Link href={`/dashboard/routes/${details.route_id}`} className="text-navy hover:underline">Route {details.route_id}</Link></p>
                          )}
                          {details.description && (
                            <p><strong>Description:</strong> {details.description}</p>
                          )}
                          {details.location && (
                            <p><strong>Location:</strong> {details.location}</p>
                          )}
                          <p><strong>Reported:</strong> {formatDateTime(details.reported_at || notification.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          onClick={() => handleFindReplacement(notification)}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Car className="mr-2 h-4 w-4" />
                          Find Replacement
                        </Button>
                        <Button
                          onClick={() => handleResolve(notification.id)}
                          disabled={resolving === notification.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {resolving === notification.id ? 'Resolving...' : 'Resolve'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tardiness Notifications */}
      {tardinessNotifications.length > 0 && (
        <Card className="border-2 border-orange-500">
          <CardContent className="p-0">
            <div className="bg-orange-600 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-5 w-5" />
                  <h2 className="text-lg font-bold">Driver Tardiness Reports</h2>
                </div>
                <span className="px-3 py-1 bg-orange-700 rounded-full text-sm font-semibold">
                  {tardinessNotifications.length} Pending
                </span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {tardinessNotifications.map((notification) => {
                const details = notification.details || {}
                const tardinessReportId = parseInt(notification.certificate_type)
                return (
                  <div
                    key={notification.id}
                    className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-orange-900">Driver Tardiness Report</h3>
                          <span className="px-2 py-1 bg-orange-600 text-white text-xs font-semibold rounded">
                            PENDING REVIEW
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p><strong>Driver:</strong> <Link href={`/dashboard/employees/${notification.entity_id}`} className="text-navy hover:underline">{details.driver_name || 'N/A'}</Link></p>
                          {details.route_number && (
                            <p><strong>Route:</strong> {details.route_number}</p>
                          )}
                          <p><strong>Session:</strong> {details.session_type || 'N/A'} - {formatDate(notification.expiry_date)}</p>
                          <p><strong>Reason:</strong> {notification.certificate_name}</p>
                          {details.reported_at && (
                            <p><strong>Reported:</strong> {formatDateTime(details.reported_at)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {showTardinessModal === notification.id ? (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <textarea
                              rows={3}
                              value={tardinessNotes[notification.id] || ''}
                              onChange={(e) => setTardinessNotes(prev => ({ ...prev, [notification.id]: e.target.value }))}
                              placeholder="Add notes (optional)..."
                              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApproveTardiness(notification)}
                                disabled={approvingTardiness === notification.id}
                                className="bg-green-600 hover:bg-green-700 text-white flex-1"
                                size="sm"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                {approvingTardiness === notification.id ? 'Approving...' : 'Approve'}
                              </Button>
                              <Button
                                onClick={() => handleDeclineTardiness(notification)}
                                disabled={decliningTardiness === notification.id}
                                className="bg-red-600 hover:bg-red-700 text-white flex-1"
                                size="sm"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                {decliningTardiness === notification.id ? 'Declining...' : 'Decline'}
                              </Button>
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setShowTardinessModal(null)
                                setTardinessNotes(prev => {
                                  const updated = { ...prev }
                                  delete updated[notification.id]
                                  return updated
                                })
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              onClick={() => setShowTardinessModal(notification.id)}
                              className="bg-orange-600 hover:bg-orange-700 text-white"
                              size="sm"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Review
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

          {/* Regular Route Activity Notifications */}
          {routeActivityNotifications.length === 0 && breakdownNotifications.length === 0 && tardinessNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No pending route activity notifications</p>
              </CardContent>
            </Card>
          ) : null}

          {routeActivityResolved.length > 0 && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                Show resolved/dismissed route activity notifications ({routeActivityResolved.length})
              </summary>
              <Card className="mt-4">
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
                        <TableRow key={notification.id}>
                          <TableCell>
                            {notification.notification_type === 'vehicle_breakdown' ? '🚨 Breakdown' : '⏰ Tardiness'}
                          </TableCell>
                          <TableCell>{getStatusBadge(notification.status, notification.days_until_expiry)}</TableCell>
                          <TableCell>
                            {notification.notification_type === 'vehicle_breakdown' ? (
                              <span>Vehicle {notification.entity_id}</span>
                            ) : (
                              <span>Driver {notification.entity_id}</span>
                            )}
                          </TableCell>
                          <TableCell>
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
        </div>
      )}

      {/* Email Editor Modal */}
      {emailEditorOpen && editingNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Edit Email</h2>
                <button
                  onClick={() => {
                    setEmailEditorOpen(false)
                    setEditingNotification(null)
                    setEmailSubject('')
                    setEmailBody('')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {loadingTemplate ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading email template...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start space-x-2">
                      <input
                        id="hold-on-send"
                        type="checkbox"
                        checked={holdOnSend}
                        onChange={(e) => setHoldOnSend(e.target.checked)}
                        className="mt-1 h-4 w-4"
                      />
                      <div>
                        <Label htmlFor="hold-on-send">Put on hold until admin clears</Label>
                        <p className="text-xs text-gray-500">
                          Flags the recipient, vehicle, and related routes as ON HOLD after sending.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <input
                        id="include-appointment-link"
                        type="checkbox"
                        checked={includeAppointmentLink}
                        onChange={(e) => setIncludeAppointmentLink(e.target.checked)}
                        className="mt-1 h-4 w-4"
                      />
                      <div>
                        <Label htmlFor="include-appointment-link">Include appointment booking link</Label>
                        <p className="text-xs text-gray-500">
                          Adds a link so the recipient can book an available slot.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email-to">To</Label>
                    <Input
                      id="email-to"
                      value={editingNotification.recipient_email || ''}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email-subject">Subject *</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email-body">Message *</Label>
                    <textarea
                      id="email-body"
                      rows={15}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      required
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You can edit the email content above. The upload link will be automatically included.
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEmailEditorOpen(false)
                        setEditingNotification(null)
                        setEmailSubject('')
                        setEmailBody('')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSendEmail}
                      disabled={sendingEmail === editingNotification.id || !emailSubject.trim() || !emailBody.trim()}
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

