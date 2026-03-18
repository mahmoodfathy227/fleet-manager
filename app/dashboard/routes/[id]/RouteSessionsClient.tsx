'use client'

import React, { useState, useEffect, useMemo, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import {
  RouteServiceHistory,
  Passenger,
  AttendanceStatus,
} from '@/lib/types'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  Play,
  Square,
  MapPin,
  FileText,
  Eye,
  Upload,
  Search,
  X,
} from 'lucide-react'
import Link from 'next/link'

interface RouteSessionsClientProps {
  routeId: number
  passengers: Passenger[]
}

export default function RouteSessionsClient({ routeId, passengers }: RouteSessionsClientProps) {
  const [sessions, setSessions] = useState<RouteServiceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<number | null>(null)
  const [attendanceData, setAttendanceData] = useState<Record<number, AttendanceStatus>>({})
  const [sessionDocuments, setSessionDocuments] = useState<Record<number, any[]>>({})
  const [sessionIncidents, setSessionIncidents] = useState<Record<number, any[]>>({})
  const [uploadingDocForSession, setUploadingDocForSession] = useState<number | null>(null)
  const [docUploadError, setDocUploadError] = useState<string | null>(null)
  const [sessionSearch, setSessionSearch] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId])

  useEffect(() => {
    if (selectedSession) {
      loadAttendanceForSession(selectedSession)
      loadDocumentsForSession(selectedSession)
      loadIncidentsForSession(selectedSession)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession])

  const loadSessions = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('route_service_history')
      .select('*')
      .eq('route_id', routeId)
      .order('session_date', { ascending: false })
      .order('session_type', { ascending: true })
      .limit(50)

    if (!error && data) {
      setSessions(data as RouteServiceHistory[])
      const sessionIds = data.map((s: any) => s.session_id)
      await Promise.all([
        ...sessionIds.map((id: number) => loadDocumentsForSession(id)),
        ...sessionIds.map((id: number) => loadIncidentsForSession(id)),
      ])
    }
    setLoading(false)
  }

  const loadAttendanceForSession = async (sessionId: number) => {
    const { data } = await supabase
      .from('route_passenger_attendance')
      .select('passenger_id, attendance_status')
      .eq('route_session_id', sessionId)

    if (data) {
      const attendanceMap: Record<number, AttendanceStatus> = {}
      data.forEach((record: any) => {
        attendanceMap[record.passenger_id] = record.attendance_status
      })
      setAttendanceData(attendanceMap)
    }
  }

  const loadDocumentsForSession = async (sessionId: number) => {
    const { data } = await supabase
      .from('documents')
      .select('id, doc_type, file_name, file_url, uploaded_at, owner_type')
      .eq('route_session_id', sessionId)
      .order('uploaded_at', { ascending: false })

    setSessionDocuments((prev) => ({
      ...prev,
      [sessionId]: data || [],
    }))
  }

  const loadIncidentsForSession = async (sessionId: number) => {
    const { data, error } = await supabase
      .from('incidents')
      .select('id, incident_type, description, reported_at, resolved, reference_number')
      .eq('route_session_id', sessionId)
      .order('reported_at', { ascending: false })

    if (error) {
      console.error('Error loading incidents for session:', sessionId, error)
      setSessionIncidents((prev) => ({ ...prev, [sessionId]: [] }))
      return
    }

    setSessionIncidents((prev) => ({ ...prev, [sessionId]: data || [] }))
  }

  const handleAddDocumentToSession = async (sessionId: number, file: File, docType: string) => {
    setUploadingDocForSession(sessionId)
    setDocUploadError(null)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        throw new Error('You must be logged in to upload documents')
      }
      const fileExt = file.name.split('.').pop() || 'bin'
      const storagePath = `route_sessions/${sessionId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const bucketName = 'DOCUMENTS'
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })
      if (uploadError) {
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
          throw new Error(`Storage bucket "${bucketName}" not found. Create a public bucket named "${bucketName}" in Supabase Storage.`)
        }
        throw uploadError
      }
      const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(storagePath)
      const { data: userData } = await supabase.from('users').select('id').eq('email', authUser.email).maybeSingle()
      const { error: docError } = await supabase.from('documents').insert({
        route_session_id: sessionId,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_path: storagePath,
        doc_type: docType || 'Session Document',
        uploaded_by: userData?.id ?? null,
      })
      if (docError) throw docError
      await loadDocumentsForSession(sessionId)
    } catch (err: any) {
      setDocUploadError(err.message || 'Upload failed')
    } finally {
      setUploadingDocForSession(null)
    }
  }

  const handleEndSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to end this session?')) return

    const { error } = await supabase
      .from('route_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (!error) {
      await Promise.all([loadDocumentsForSession(sessionId), loadIncidentsForSession(sessionId)])
      await loadSessions()
    } else {
      alert('Error ending session: ' + error.message)
    }
  }

  const handleMarkAttendance = async (sessionId: number, passengerId: number, status: AttendanceStatus) => {
    const { data: auth } = await supabase.auth.getUser()
    const authUser = auth?.user
    let markedBy: number | null = null

    if (authUser?.email) {
      const { data: userData } = await supabase
        .from('users')
        .select('employee_id')
        .eq('email', authUser.email)
        .single()

      if (userData?.employee_id) markedBy = userData.employee_id
    }

    const { error } = await supabase.rpc('mark_passenger_attendance', {
      p_route_session_id: sessionId,
      p_passenger_id: passengerId,
      p_status: status,
      p_notes: null,
      p_marked_by: markedBy,
    })

    if (!error) {
      setAttendanceData((prev) => ({ ...prev, [passengerId]: status }))
      loadSessions()
    } else {
      alert('Error marking attendance: ' + error.message)
    }
  }

  const activeSessions = sessions.filter((s) => s.started_at && !s.ended_at)
  // Only show sessions that have started (exclude future / not-started sessions)
  const startedSessions = sessions.filter((s) => s.started_at != null)

  const filteredStartedSessions = useMemo(() => {
    if (!sessionSearch.trim()) return startedSessions
    const term = sessionSearch.trim().toLowerCase()
    return startedSessions.filter((session) => {
      const dateStr = formatDate(session.session_date).toLowerCase()
      const type = (session.session_type || '').toLowerCase()
      const status = session.ended_at ? 'completed' : 'started'
      return dateStr.includes(term) || type.includes(term) || status.includes(term)
    })
  }, [startedSessions, sessionSearch])

  const getStatusIcon = (status: AttendanceStatus) => {
    const icons: Record<AttendanceStatus, ReactNode> = {
      present: <CheckCircle className="h-4 w-4 text-green-600" />,
      absent: <XCircle className="h-4 w-4 text-red-600" />,
      late: <AlertCircle className="h-4 w-4 text-yellow-600" />,
      excused: <UserCheck className="h-4 w-4 text-blue-600" />,
    }
    return icons[status] ?? null
  }

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800'
      case 'absent':
        return 'bg-red-100 text-red-800'
      case 'late':
        return 'bg-yellow-100 text-yellow-800'
      case 'excused':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-3">
      {/* Current session — always show: running session or "No session currently running" */}
      <Card className={activeSessions.length > 0 ? 'border-l-4 border-l-green-500' : ''}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center ${activeSessions.length > 0 ? 'text-green-700' : 'text-slate-700'}`}>
              <MapPin className={`mr-1.5 h-4 w-4 ${activeSessions.length > 0 ? 'text-green-600' : 'text-slate-500'}`} />
              {activeSessions.length > 0 ? 'Session Running' : 'Current Session'}
            </h2>
            {activeSessions.length > 0 && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
                {activeSessions.length} Active
              </span>
            )}
          </div>

          {activeSessions.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-4">No session currently running.</p>
          ) : (
            <div className="space-y-2">
              {activeSessions.map((session) => (
                <div key={session.session_id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-green-100 rounded-full">
                        <Play className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {formatDate(session.session_date)} - {session.session_type}
                          </span>
                          <span className="px-1.5 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded">
                            En Route
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          {session.driver_name && <span>Driver: {session.driver_name}</span>}
                          {session.passenger_assistant_name && <span>PA: {session.passenger_assistant_name}</span>}
                          {session.started_at && <span className="text-green-600 font-medium">Started: {formatDateTime(session.started_at)}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/dashboard/incidents/create?route_session_id=${session.session_id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200">
                          <AlertCircle className="mr-1 h-3 w-3" />Add Incident
                        </Button>
                      </Link>
                      <Link href={`/dashboard/incidents?route_session_id=${session.session_id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-600 hover:bg-slate-100 border border-slate-200">
                          View incidents
                        </Button>
                      </Link>
                      <Button variant="danger" size="sm" className="h-7 px-2 text-xs" onClick={() => handleEndSession(session.session_id)}>
                        <Square className="mr-1 h-3 w-3" />End Session
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setSelectedSession(selectedSession === session.session_id ? null : session.session_id)}
                      >
                        {selectedSession === session.session_id ? 'Hide' : 'Attendance'}
                      </Button>
                    </div>
                  </div>

                  {/* Upload document section */}
                  <div className="mt-2 p-2 bg-white rounded border border-green-200">
                    <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-1.5">
                      <FileText className="h-3 w-3" /> Upload document (TR5, TR6, TR7)
                    </h4>
                    {docUploadError && <p className="text-[10px] text-red-600 mb-1">{docUploadError}</p>}
                    <form
                      className="flex flex-wrap items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        const form = e.currentTarget
                        const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]')
                        const typeSelect = form.querySelector<HTMLSelectElement>('select[name="doc_type"]')
                        const file = fileInput?.files?.[0]
                        if (!file) { setDocUploadError('Please select a file.'); return }
                        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
                        if (!allowed.includes(file.type)) { setDocUploadError('Only images and PDF allowed.'); return }
                        if (file.size > 10 * 1024 * 1024) { setDocUploadError('File must be under 10 MB.'); return }
                        handleAddDocumentToSession(session.session_id, file, typeSelect?.value || 'Session Document')
                        fileInput.value = ''
                      }}
                    >
                      <div className="flex-1 min-w-[100px]">
                        <Label htmlFor={`active-doc-file-${session.session_id}`} className="text-[10px]">File</Label>
                        <Input id={`active-doc-file-${session.session_id}`} type="file" accept=".pdf,image/jpeg,image/jpg,image/png,image/gif" className="h-7 text-xs" />
                      </div>
                      <div className="w-28">
                        <Label htmlFor={`active-doc-type-${session.session_id}`} className="text-[10px]">Type</Label>
                        <Select id={`active-doc-type-${session.session_id}`} name="doc_type" className="h-7 text-xs">
                          <option value="Session Document">Session Doc</option>
                          <option value="TR5">TR5</option>
                          <option value="TR6">TR6</option>
                          <option value="TR7">TR7</option>
                        </Select>
                      </div>
                      <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={uploadingDocForSession === session.session_id}>
                        {uploadingDocForSession === session.session_id ? '...' : <><Upload className="h-3 w-3 mr-1" />Upload</>}
                      </Button>
                    </form>
                  </div>

                  {/* Attendance list */}
                  {selectedSession === session.session_id && (
                    <div className="mt-4 border-t border-green-300 pt-4">
                      <h4 className="font-semibold mb-3 flex items-center">
                        <Users className="mr-2 h-4 w-4" />
                        Mark Attendance ({passengers.length} passengers)
                      </h4>

                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {passengers.length === 0 ? (
                          <p className="text-center text-gray-500 py-4">No passengers on this route.</p>
                        ) : (
                          passengers.map((passenger) => {
                            const currentStatus = attendanceData[passenger.id] || 'absent'
                            return (
                              <div
                                key={passenger.id}
                                className="flex items-center justify-between p-3 bg-white rounded border border-green-200 hover:bg-green-50 transition-colors"
                              >
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <span className="font-medium truncate">{passenger.full_name}</span>
                                  {passenger.seat_number && (
                                    <span className="text-sm text-gray-500 whitespace-nowrap">Seat: {passenger.seat_number}</span>
                                  )}
                                  <span className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 whitespace-nowrap ${getStatusColor(currentStatus)}`}>
                                    {getStatusIcon(currentStatus)}
                                    <span className="capitalize">{currentStatus}</span>
                                  </span>
                                </div>

                                <div className="flex space-x-1 ml-4">
                                  {(['present', 'absent', 'late', 'excused'] as AttendanceStatus[]).map((status) => (
                                    <Button
                                      key={status}
                                      variant={currentStatus === status ? 'primary' : 'ghost'}
                                      size="sm"
                                      onClick={() => handleMarkAttendance(session.session_id, passenger.id, status)}
                                      className="text-xs px-2"
                                      title={`Mark as ${status}`}
                                    >
                                      {getStatusIcon(status)}
                                      <span className="ml-1 capitalize hidden md:inline">{status}</span>
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session History */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-500" />
              Session History
            </h2>
            {!loading && startedSessions.length > 0 && (
              <span className="px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full text-[10px] font-bold border border-slate-100">
                {filteredStartedSessions.length}/{startedSessions.length}
              </span>
            )}
          </div>

          {!loading && startedSessions.length > 0 && (
            <div className="mb-2 relative max-w-xs">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by date, AM/PM..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="pl-7 pr-7 h-7 text-xs"
              />
              {sessionSearch && (
                <button type="button" onClick={() => setSessionSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-center text-slate-400 text-sm py-4">Loading...</p>
          ) : startedSessions.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-4">No sessions recorded.</p>
          ) : filteredStartedSessions.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-4">No matching sessions.</p>
          ) : (
            <div className="space-y-1">
              {filteredStartedSessions.map((session) => {
                const isCompleted = session.ended_at !== null

                return (
                  <div key={session.session_id} className="p-2 hover:bg-slate-50 rounded border-b border-slate-100 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded bg-slate-100 text-slate-500">
                          <Calendar className="h-3 w-3" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {formatDate(session.session_date)} — {session.session_type}
                          </span>
                          {isCompleted && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">Done</span>
                          )}
                          {!session.started_at && !session.ended_at && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">Not Started</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setSelectedSession(selectedSession === session.session_id ? null : session.session_id)}
                      >
                        {selectedSession === session.session_id ? 'Hide' : 'View details'}
                      </Button>
                    </div>

                    {selectedSession === session.session_id && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                        {/* Documents */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-1">
                            <FileText className="h-3 w-3" /> Documents
                          </h4>
                          {(sessionDocuments[session.session_id]?.length ?? 0) === 0 ? (
                            <p className="text-xs text-slate-400">None</p>
                          ) : (
                            <ul className="space-y-1">
                              {sessionDocuments[session.session_id]?.map((doc: any) => (
                                <li key={doc.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1 border border-slate-100">
                                  <span className="font-medium text-slate-700 truncate">{doc.file_name || doc.doc_type || 'Document'}</span>
                                  {doc.file_url && (
                                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                      <Eye className="h-3 w-3" /> View
                                    </a>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100">
                            <p className="text-[10px] font-medium text-slate-500 mb-1">Add document</p>
                            {docUploadError && selectedSession === session.session_id && (
                              <p className="text-[10px] text-red-600 mb-1">{docUploadError}</p>
                            )}
                            <form
                              className="flex flex-wrap items-end gap-2"
                              onSubmit={(e) => {
                                e.preventDefault()
                                const form = e.currentTarget
                                const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]')
                                const typeSelect = form.querySelector<HTMLSelectElement>('select[name="doc_type"]')
                                const file = fileInput?.files?.[0]
                                if (!file) { setDocUploadError('Select a file.'); return }
                                const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
                                if (!allowed.includes(file.type)) { setDocUploadError('Images/PDF only.'); return }
                                if (file.size > 10 * 1024 * 1024) { setDocUploadError('Max 10 MB.'); return }
                                handleAddDocumentToSession(session.session_id, file, typeSelect?.value || 'Session Document')
                                fileInput.value = ''
                              }}
                            >
                              <div className="flex-1 min-w-[100px]">
                                <Label htmlFor={`doc-file-${session.session_id}`} className="text-[10px]">File</Label>
                                <Input id={`doc-file-${session.session_id}`} type="file" accept=".pdf,image/jpeg,image/jpg,image/png,image/gif" className="h-7 text-xs" />
                              </div>
                              <div className="w-24">
                                <Label htmlFor={`doc-type-${session.session_id}`} className="text-[10px]">Type</Label>
                                <Select id={`doc-type-${session.session_id}`} name="doc_type" className="h-7 text-xs">
                                  <option value="Session Document">Doc</option>
                                  <option value="TR5">TR5</option>
                                  <option value="TR6">TR6</option>
                                  <option value="TR7">TR7</option>
                                </Select>
                              </div>
                              <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={uploadingDocForSession === session.session_id}>
                                {uploadingDocForSession === session.session_id ? '...' : <><Upload className="h-3 w-3 mr-1" />Upload</>}
                              </Button>
                            </form>
                          </div>
                        </div>

                        {/* Incidents */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-1">
                            <AlertCircle className="h-3 w-3" /> Incidents
                          </h4>
                          {(sessionIncidents[session.session_id]?.length ?? 0) === 0 ? (
                            <p className="text-xs text-slate-400">None</p>
                          ) : (
                            <ul className="space-y-1">
                              {sessionIncidents[session.session_id]?.map((incident: any) => (
                                <li key={incident.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1 border border-slate-100">
                                  <span className="text-slate-700 truncate">
                                    {incident.reference_number ? `${incident.reference_number} — ` : ''}{incident.incident_type || 'Incident'}
                                  </span>
                                  <Link href={`/dashboard/incidents/${incident.id}`} className="text-primary hover:underline flex items-center gap-1">
                                    <Eye className="h-3 w-3" /> View
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Passenger attendance */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-1">
                            <UserCheck className="h-3 w-3" /> Attendance
                          </h4>
                          {passengers.length === 0 ? (
                            <p className="text-xs text-slate-400">No passengers</p>
                          ) : (
                            <ul className="space-y-1">
                              {passengers.map((passenger) => {
                                const status = attendanceData[passenger.id] ?? 'absent'
                                return (
                                  <li key={passenger.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1 border border-slate-100">
                                    <span className="font-medium text-slate-700 truncate">{passenger.full_name}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${status === 'present' ? 'bg-emerald-100 text-emerald-700' : status === 'absent' ? 'bg-red-100 text-red-700' : status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                                      {status}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div >
  )
} 