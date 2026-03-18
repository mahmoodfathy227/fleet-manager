'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Clock, CheckCircle, XCircle, AlertCircle, Square, MapPin, Wrench, AlertCircle as AlertCircleIcon, X } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import VehiclePreCheckForm, { VehiclePreCheckData } from './VehiclePreCheckForm'

export default function StartSessionPage() {
  const params = useParams()
  const qrToken = params?.qrToken as string
  const [loading, setLoading] = useState(false)
  const [loadingActive, setLoadingActive] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [driverInfo, setDriverInfo] = useState<{
    name: string
    routeName: string | null
    driverId: number | null
    routeId: number | null
    vehicleId: number | null
  } | null>(null)
  const [showPreCheckForm, setShowPreCheckForm] = useState(false)
  const [pendingSessionType, setPendingSessionType] = useState<'AM' | 'PM' | null>(null)
  const [activeSessions, setActiveSessions] = useState<Array<{
    id: number
    session_date: string
    session_type: string
    started_at: string
    route_name: string | null
    route_id: number | null
  }>>([])
  const [sessionResult, setSessionResult] = useState<{
    success: boolean
    message: string
    sessionId?: number
    routeName?: string
    sessionType?: string
    sessionDate?: string
  } | null>(null)
  const [reportingBreakdown, setReportingBreakdown] = useState(false)
  const [breakdownReported, setBreakdownReported] = useState(false)
  const [showTardinessModal, setShowTardinessModal] = useState(false)
  const [selectedSessionType, setSelectedSessionType] = useState<'AM' | 'PM' | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [tardinessReason, setTardinessReason] = useState('')
  const [tardinessNotes, setTardinessNotes] = useState('')
  const [submittingTardiness, setSubmittingTardiness] = useState(false)

  const tardinessReasons = [
    'Traffic congestion',
    'Vehicle issue',
    'Personal emergency',
    'Weather conditions',
    'Route change',
    'Other'
  ]

  const supabase = createClient()

  useEffect(() => {
    loadDriverInfo()
  }, [qrToken])

  useEffect(() => {
    if (driverInfo?.driverId) {
      loadActiveSessions()
    }
  }, [driverInfo])

  const loadDriverInfo = async () => {
    if (!qrToken) {
      setLoadingActive(false)
      setLoadError('Invalid QR token')
      return
    }

    setLoadingActive(true)
    setLoadError(null)

    try {
      // First get the driver
      const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .select(`
        employee_id,
          employees(full_name)
      `)
      .eq('qr_token', qrToken)
      .single()

      if (driverError) {
        console.error('Error loading driver info:', driverError)
        if (driverError.code === 'PGRST116') {
          setLoadError('Driver not found with this QR code')
        } else {
          setLoadError(driverError.message || 'Failed to load driver information')
        }
        setDriverInfo(null)
        return
      }

      if (!driverData) {
        setLoadError('Driver not found')
        setDriverInfo(null)
        return
      }

      const employee = Array.isArray(driverData.employees) ? driverData.employees[0] : driverData.employees
      
      if (!employee) {
        setLoadError('Driver employee record not found')
        setDriverInfo(null)
        return
      }

      // Now get the route assigned to this driver (including vehicle_id)
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .select('id, route_number, vehicle_id')
        .eq('driver_id', driverData.employee_id)
        .maybeSingle()

      // Don't treat missing route as an error - driver might not be assigned yet
      const route = routeError ? null : routeData

      setDriverInfo({
        name: employee.full_name || 'Unknown Driver',
        routeName: route?.route_number || null,
        driverId: driverData.employee_id,
        routeId: route?.id || null,
        vehicleId: route?.vehicle_id || null,
      })
      setLoadError(null)
    } catch (err: any) {
      console.error('Exception loading driver info:', err)
      setLoadError(err.message || 'An unexpected error occurred')
      setDriverInfo(null)
    } finally {
    setLoadingActive(false)
    }
  }

  const loadActiveSessions = async () => {
    if (!driverInfo?.driverId) return

    const { data, error } = await supabase
      .from('route_sessions')
      .select(`
        id,
        session_date,
        session_type,
        started_at,
        route_id,
        routes(route_number)
      `)
      .eq('driver_id', driverInfo.driverId)
      .is('ended_at', null)
      .not('started_at', 'is', null)
      .order('session_date', { ascending: false })
      .order('session_type', { ascending: true })

    if (!error && data) {
      setActiveSessions(data.map((s: any) => ({
        id: s.id,
        session_date: s.session_date,
        session_type: s.session_type,
        started_at: s.started_at,
        route_name: s.routes?.route_number || null,
        route_id: s.route_id || null,
      })))
    }
    setLoadingActive(false)
  }

  const handleEndSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to end this session?')) {
      return
    }

    setLoading(true)
    const { error } = await supabase
      .from('route_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)

    setLoading(false)

    if (!error) {
      await loadActiveSessions()
      setSessionResult({
        success: true,
        message: 'Session ended successfully',
      })
      setTimeout(() => setSessionResult(null), 3000)
    } else {
      setSessionResult({
        success: false,
        message: 'Error ending session: ' + error.message,
      })
    }
  }

  const handleReportBreakdown = async (sessionId: number) => {
    if (!confirm('Report vehicle breakdown? This will create an urgent notification for administrators.')) {
      return
    }

    setReportingBreakdown(true)
    try {
      const { data, error } = await supabase.rpc('report_vehicle_breakdown', {
        p_route_session_id: sessionId,
        p_description: 'Vehicle breakdown reported via driver/PA QR code',
        p_location: null
      })

      if (error) {
        alert('Error reporting breakdown: ' + error.message)
      } else {
        setBreakdownReported(true)
        alert('Breakdown reported successfully! Administrators have been notified.')
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to report breakdown'))
    } finally {
      setReportingBreakdown(false)
    }
  }

  const handleStartSession = async (sessionType: 'AM' | 'PM') => {
    if (!qrToken) return

    // For AM routes, require vehicle pre-check
    if (sessionType === 'AM') {
      setPendingSessionType(sessionType)
      setShowPreCheckForm(true)
      return
    }

    // For PM routes, start directly
    await startSessionAfterPreCheck(sessionType, null)
  }

  const startSessionAfterPreCheck = async (
    sessionType: 'AM' | 'PM',
    preCheckData: VehiclePreCheckData | null
  ) => {
    if (!qrToken || !driverInfo) return

    setLoading(true)
    setSessionResult(null)

    // Start the route session
    const { data, error } = await supabase.rpc('start_route_session_from_qr', {
      p_qr_token: qrToken,
      p_session_type: sessionType,
    })

    if (error) {
      setLoading(false)
      setSessionResult({
        success: false,
        message: error.message || 'Failed to start session',
      })
      return
    }

    if (data) {
      const result = data as any
      if (result.success) {
        // Save pre-check if provided (for AM routes)
        if (preCheckData && result.session_id) {
          const { error: preCheckError } = await supabase
            .from('vehicle_pre_checks')
            .insert({
              route_session_id: result.session_id,
              driver_id: driverInfo.driverId,
              vehicle_id: driverInfo.vehicleId,
              session_type: sessionType,
              check_date: new Date().toISOString().split('T')[0],
              lights_working: preCheckData.lights_working,
              mirrors_adjusted: preCheckData.mirrors_adjusted,
              tires_condition: preCheckData.tires_condition,
              body_damage: preCheckData.body_damage,
              windows_clean: preCheckData.windows_clean,
              dashboard_lights: preCheckData.dashboard_lights,
              horn_working: preCheckData.horn_working,
              wipers_working: preCheckData.wipers_working,
              seatbelts_working: preCheckData.seatbelts_working,
              interior_clean: preCheckData.interior_clean,
              first_aid_kit: preCheckData.first_aid_kit,
              fire_extinguisher: preCheckData.fire_extinguisher,
              warning_triangle: preCheckData.warning_triangle,
              emergency_kit: preCheckData.emergency_kit,
              engine_oil_level: preCheckData.engine_oil_level,
              coolant_level: preCheckData.coolant_level,
              brake_fluid: preCheckData.brake_fluid,
              fuel_level_adequate: preCheckData.fuel_level_adequate,
              notes: preCheckData.notes || null,
              issues_found: preCheckData.issues_found || null,
              media_urls: preCheckData.media_urls || null,
            })

          if (preCheckError) {
            console.error('Error saving pre-check:', preCheckError)
            // Don't fail the session start if pre-check save fails
          }
        }

        setSessionResult({
          success: true,
          message: result.message || 'Session started successfully',
          sessionId: result.session_id,
          routeName: result.route_name,
          sessionType: result.session_type,
          sessionDate: result.session_date,
        })
        // Reload active sessions to show the newly started session
        await loadActiveSessions()
      } else {
        setSessionResult({
          success: false,
          message: result.error || 'Failed to start session',
        })
      }
    }

    setLoading(false)
  }

  const handlePreCheckComplete = async (checkData: VehiclePreCheckData) => {
    if (!pendingSessionType) return

    setShowPreCheckForm(false)
    await startSessionAfterPreCheck(pendingSessionType, checkData)
    setPendingSessionType(null)
  }

  const handlePreCheckCancel = () => {
    setShowPreCheckForm(false)
    setPendingSessionType(null)
  }

  const handleOpenTardinessModal = (sessionType: 'AM' | 'PM', sessionId?: number) => {
    setSelectedSessionType(sessionType)
    setSelectedSessionId(sessionId || null)
    setTardinessReason('')
    setTardinessNotes('')
    setShowTardinessModal(true)
  }

  const handleSubmitTardiness = async () => {
    if (!tardinessReason || !selectedSessionType || !driverInfo?.driverId) {
      alert('Please select a reason for being late')
      return
    }

    setSubmittingTardiness(true)
    try {
      // If reporting from an active session, use that session's route_id
      const routeId = selectedSessionId 
        ? activeSessions.find(s => s.id === selectedSessionId)?.route_id || driverInfo.routeId
        : driverInfo.routeId

      const response = await fetch('/api/tardiness/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driverInfo.driverId,
          routeId: routeId,
          routeSessionId: selectedSessionId || null,
          sessionType: selectedSessionType,
          reason: tardinessReason,
          additionalNotes: tardinessNotes || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to report tardiness')
      }

      alert('Tardiness reported successfully! Coordinator has been notified.')
      setShowTardinessModal(false)
      setTardinessReason('')
      setTardinessNotes('')
      setSelectedSessionType(null)
      setSelectedSessionId(null)
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to report tardiness'))
    } finally {
      setSubmittingTardiness(false)
    }
  }

  if (!qrToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="bg-red-600 text-white">
            <CardTitle className="text-white">Invalid QR Code</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">
              The QR code is invalid or missing. Please scan a valid driver QR code.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-blue-900 text-white">
          <CardTitle className="text-white flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Start Route Session
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {driverInfo ? (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">Driver</p>
                <p className="text-lg font-semibold text-gray-900">{driverInfo.name}</p>
                {driverInfo.routeName && (
                  <>
                    <p className="text-sm text-gray-600 mt-2">Assigned Route</p>
                    <p className="text-lg font-semibold text-blue-900">{driverInfo.routeName}</p>
                  </>
                )}
              </div>

              {/* Active Sessions */}
              {loadingActive ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-900"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading active sessions...</p>
                </div>
              ) : activeSessions.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg border-2 border-green-500">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-green-900">Active Sessions (En Route)</h3>
                    </div>
                    <span className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded-full">
                      {activeSessions.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-3 bg-white rounded border border-green-300"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {formatDate(session.session_date)} - {session.session_type}
                            </p>
                            <p className="text-sm text-gray-600">
                              Route: {session.route_name || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">
                              Started: {formatDateTime(session.started_at)}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleOpenTardinessModal(session.session_type as 'AM' | 'PM', session.id)}
                              disabled={loading || submittingTardiness}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              <AlertCircleIcon className="mr-2 h-4 w-4" />
                              Report Tardiness
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleReportBreakdown(session.id)}
                              disabled={loading || reportingBreakdown || breakdownReported}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Wrench className="mr-2 h-4 w-4" />
                              {breakdownReported ? 'Reported' : 'Report Breakdown'}
                            </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleEndSession(session.id)}
                            disabled={loading}
                          >
                            <Square className="mr-2 h-4 w-4" />
                            End Session
                          </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sessionResult ? (
                <div className={`p-4 rounded-lg ${
                  sessionResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-start space-x-3">
                    {sessionResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        sessionResult.success ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {sessionResult.message}
                      </p>
                      {sessionResult.success && sessionResult.routeName && (
                        <div className="mt-2 text-sm text-green-700">
                          <p>Route: {sessionResult.routeName}</p>
                          <p>Session: {sessionResult.sessionType} - {sessionResult.sessionDate}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={() => setSessionResult(null)}
                  >
                    Start Another Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-center text-gray-600 text-sm">
                    Select the session type to start:
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => handleStartSession('AM')}
                      disabled={loading}
                      className="h-20 flex flex-col items-center justify-center space-y-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <Clock className="h-6 w-6" />
                      <span className="text-lg font-semibold">AM</span>
                      <span className="text-xs">Morning</span>
                    </Button>
                    
                    <Button
                      onClick={() => handleStartSession('PM')}
                      disabled={loading}
                      className="h-20 flex flex-col items-center justify-center space-y-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <Clock className="h-6 w-6" />
                      <span className="text-lg font-semibold">PM</span>
                      <span className="text-xs">Afternoon</span>
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-center text-gray-600 text-sm mb-3">
                      Running late?
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        onClick={() => handleOpenTardinessModal('AM')}
                        disabled={loading}
                        className="h-16 flex flex-col items-center justify-center space-y-1 bg-orange-600 hover:bg-orange-700"
                      >
                        <AlertCircleIcon className="h-5 w-5" />
                        <span className="text-sm font-semibold">Late - AM</span>
                      </Button>
                      
                      <Button
                        onClick={() => handleOpenTardinessModal('PM')}
                        disabled={loading}
                        className="h-16 flex flex-col items-center justify-center space-y-1 bg-orange-600 hover:bg-orange-700"
                      >
                        <AlertCircleIcon className="h-5 w-5" />
                        <span className="text-sm font-semibold">Late - PM</span>
                      </Button>
                    </div>
                  </div>

                  {loading && (
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-900"></div>
                      <p className="mt-2 text-sm text-gray-600">Starting session...</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : loadError ? (
            <div className="text-center py-8">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="text-red-900 font-medium mb-1">Error Loading Driver</p>
                <p className="text-sm text-red-700">{loadError}</p>
                <Button
                  onClick={() => {
                    setLoadError(null)
                    loadDriverInfo()
                  }}
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
              <p className="mt-4 text-gray-600">Loading driver information...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Pre-Check Modal */}
      {showPreCheckForm && driverInfo && pendingSessionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="bg-blue-900 text-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center">
                  <Wrench className="mr-2 h-5 w-5" />
                  Vehicle Pre-Check Required
                </CardTitle>
                <button
                  onClick={handlePreCheckCancel}
                  className="text-white hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 overflow-y-auto flex-1">
              <VehiclePreCheckForm
                driverId={driverInfo.driverId!}
                routeId={driverInfo.routeId}
                vehicleId={driverInfo.vehicleId}
                sessionType={pendingSessionType}
                onComplete={handlePreCheckComplete}
                onCancel={handlePreCheckCancel}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tardiness Modal */}
      {showTardinessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="bg-orange-600 text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center">
                  <AlertCircleIcon className="mr-2 h-5 w-5" />
                  Report Tardiness - {selectedSessionType}
                  {selectedSessionId && <span className="ml-2 text-sm opacity-90">(Active Session)</span>}
                </CardTitle>
                <button
                  onClick={() => {
                    setShowTardinessModal(false)
                    setTardinessReason('')
                    setTardinessNotes('')
                    setSelectedSessionType(null)
                    setSelectedSessionId(null)
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="tardiness-reason">Reason for being late *</Label>
                <Select
                  id="tardiness-reason"
                  value={tardinessReason}
                  onChange={(e) => setTardinessReason(e.target.value)}
                  required
                >
                  <option value="">Select a reason...</option>
                  {tardinessReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="tardiness-notes">Additional Notes (Optional)</Label>
                <textarea
                  id="tardiness-notes"
                  rows={3}
                  value={tardinessNotes}
                  onChange={(e) => setTardinessNotes(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Provide any additional details..."
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowTardinessModal(false)
                    setTardinessReason('')
                    setTardinessNotes('')
                    setSelectedSessionType(null)
                    setSelectedSessionId(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitTardiness}
                  disabled={submittingTardiness || !tardinessReason}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {submittingTardiness ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

