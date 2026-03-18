'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import {
  RouteServiceHistory,
  AttendanceStatus,
  SessionType
} from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Calendar, Users, CheckCircle, XCircle, AlertCircle, UserCheck, Eye } from 'lucide-react'
import Link from 'next/link'

interface SchoolRouteSessionsClientProps {
  schoolId: number
  routes: Array<{ id: number; route_number: string | null }>
}

export default function SchoolRouteSessionsClient({ schoolId, routes }: SchoolRouteSessionsClientProps) {
  const [sessions, setSessions] = useState<RouteServiceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadSessions()
  }, [schoolId])

  const loadSessions = async () => {
    setLoading(true)
    // Get all route IDs for this school
    const routeIds = routes.map(r => r.id)

    if (routeIds.length === 0) {
      setSessions([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('route_service_history')
      .select('*')
      .in('route_id', routeIds)
      .order('session_date', { ascending: false })
      .order('session_type', { ascending: true })
      .limit(100)

    if (!error && data) {
      // Only show sessions that have started (exclude future / not-started sessions)
      setSessions((data as RouteServiceHistory[]).filter((s) => s.started_at != null))
    }
    setLoading(false)
  }

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />
      case 'absent':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'late':
        return <AlertCircle className="h-4 w-4 text-amber-600" />
      case 'excused':
        return <UserCheck className="h-4 w-4 text-sky-600" />
      default:
        return null
    }
  }

  const filteredSessions = selectedRoute
    ? sessions.filter(s => s.route_id === selectedRoute)
    : sessions

  // Group sessions by route
  const sessionsByRoute = routes.map(route => {
    const routeSessions = sessions.filter(s => s.route_id === route.id)
    const recentSessions = routeSessions.slice(0, 5) // Last 5 sessions
    const totalPresent = routeSessions.reduce((sum, s) => sum + s.present_count, 0)
    const totalAbsent = routeSessions.reduce((sum, s) => sum + s.absent_count, 0)
    const totalLate = routeSessions.reduce((sum, s) => sum + s.late_count, 0)
    const totalExcused = routeSessions.reduce((sum, s) => sum + s.excused_count, 0)

    return {
      route,
      sessions: recentSessions,
      totalSessions: routeSessions.length,
      totalPresent,
      totalAbsent,
      totalLate,
      totalExcused,
    }
  })

  return (
    <div className="space-y-6">
      {/* Route Sessions Summary */}
      <Card>
        <CardHeader className="bg-navy text-white rounded-t-xl [&_.text-xl]:text-white">
          <CardTitle>Route Sessions & Attendance Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-2.5">
          {loading ? (
            <p className="text-center text-slate-500 py-4 text-sm">Loading sessions...</p>
          ) : routes.length === 0 ? (
            <p className="text-center text-slate-500 py-4 text-sm">No routes found for this school.</p>
          ) : (
            <div className="space-y-4">
              {sessionsByRoute.map(({ route, sessions: routeSessions, totalSessions, totalPresent, totalAbsent, totalLate, totalExcused }) => (
                <Card key={route.id}>
                  <CardHeader className="bg-slate-50 border-b border-slate-200 py-3 px-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          {route.route_number || `Route ${route.id}`}
                        </CardTitle>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {totalSessions} total session{totalSessions !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs border-slate-300 text-slate-600 hover:bg-slate-50"
                          onClick={() => setSelectedRoute(selectedRoute === route.id ? null : route.id)}
                        >
                          {selectedRoute === route.id ? 'Hide Details' : 'Show Details'}
                        </Button>
                        <Link href={`/dashboard/routes/${route.id}`}>
                          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs border-slate-300 text-slate-600 hover:bg-slate-50">
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            View Route
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="text-center p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xl font-bold text-emerald-700">{totalPresent}</div>
                        <div className="text-xs text-slate-500">Total Present</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xl font-bold text-red-700">{totalAbsent}</div>
                        <div className="text-xs text-slate-500">Total Absent</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xl font-bold text-amber-700">{totalLate}</div>
                        <div className="text-xs text-slate-500">Total Late</div>
                      </div>
                      <div className="text-center p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-xl font-bold text-sky-700">{totalExcused}</div>
                        <div className="text-xs text-slate-500">Total Excused</div>
                      </div>
                    </div>

                    {selectedRoute === route.id && routeSessions.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          Recent Sessions
                        </h4>
                        <div className="space-y-2">
                          {routeSessions.map((session) => (
                            <div
                              key={session.session_id}
                              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100/80 transition-colors"
                            >
                              <div>
                                <div className="text-sm font-medium text-slate-900">
                                  {formatDate(session.session_date)} — {session.session_type}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {session.driver_name && `Driver: ${session.driver_name}`}
                                  {session.driver_name && session.passenger_assistant_name && ' · '}
                                  {session.passenger_assistant_name && `PA: ${session.passenger_assistant_name}`}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-emerald-700 font-medium">{session.present_count} present</span>
                                  <span className="text-red-700 font-medium">{session.absent_count} absent</span>
                                  {session.late_count > 0 && (
                                    <span className="text-amber-700 font-medium">{session.late_count} late</span>
                                  )}
                                  {session.excused_count > 0 && (
                                    <span className="text-sky-700 font-medium">{session.excused_count} excused</span>
                                  )}
                                </div>
                                <Link href={`/dashboard/routes/${route.id}`}>
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-600">
                                    View Details
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          ))}
                          {totalSessions > routeSessions.length && (
                            <div className="text-center pt-2">
                              <Link href={`/dashboard/routes/${route.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-600">
                                  View all {totalSessions} sessions
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedRoute === route.id && routeSessions.length === 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-4 text-center text-slate-500 text-sm">
                        No sessions recorded for this route yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Sessions Table View */}
      {filteredSessions.length > 0 && (
        <Card>
          <CardHeader className="bg-navy text-white rounded-t-xl [&_.text-xl]:text-white">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>
                All Route Sessions
                {selectedRoute && ` — ${routes.find(r => r.id === selectedRoute)?.route_number || `Route ${selectedRoute}`}`}
              </CardTitle>
              {selectedRoute && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2.5 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                  onClick={() => setSelectedRoute(null)}
                >
                  Show All Routes
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-2.5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-1.5">Date</TableHead>
                    <TableHead className="text-xs py-1.5">Type</TableHead>
                    <TableHead className="text-xs py-1.5">Route</TableHead>
                    <TableHead className="text-xs py-1.5">Driver</TableHead>
                    <TableHead className="text-xs py-1.5">PA</TableHead>
                    <TableHead className="text-xs py-1.5">Present</TableHead>
                    <TableHead className="text-xs py-1.5">Absent</TableHead>
                    <TableHead className="text-xs py-1.5">Late</TableHead>
                    <TableHead className="text-xs py-1.5">Excused</TableHead>
                    <TableHead className="text-xs py-1.5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session) => (
                    <TableRow key={session.session_id}>
                      <TableCell className="text-xs py-1.5">{formatDate(session.session_date)}</TableCell>
                      <TableCell className="py-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${session.session_type === 'AM'
                            ? 'bg-sky-100 text-sky-800'
                            : 'bg-violet-100 text-violet-800'
                          }`}>
                          {session.session_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs py-1.5 font-medium text-slate-900">
                        {session.route_name || `Route ${session.route_id}`}
                      </TableCell>
                      <TableCell className="text-xs py-1.5 text-slate-600">{session.driver_name || '—'}</TableCell>
                      <TableCell className="text-xs py-1.5 text-slate-600">{session.passenger_assistant_name || '—'}</TableCell>
                      <TableCell className="text-xs py-1.5">
                        <span className="text-emerald-700 font-medium">{session.present_count}</span>
                      </TableCell>
                      <TableCell className="text-xs py-1.5">
                        <span className="text-red-700 font-medium">{session.absent_count}</span>
                      </TableCell>
                      <TableCell className="text-xs py-1.5">
                        {session.late_count > 0 ? (
                          <span className="text-amber-700 font-medium">{session.late_count}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-1.5">
                        {session.excused_count > 0 ? (
                          <span className="text-sky-700 font-medium">{session.excused_count}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Link href={`/dashboard/routes/${session.route_id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

