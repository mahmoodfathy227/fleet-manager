'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Download, Calendar } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'
import { exportToCSV } from '@/lib/utils/csvExport'

interface DailySummary {
  route_session_id: number
  route_id: number
  route_name: string
  session_date: string
  session_type: string
  driver_name: string
  passenger_assistant_name: string
  started_at: string | null
  ended_at: string | null
  absent_count: number
  present_count: number
  late_count: number
  excused_count: number
  incident_count: number
  incident_refs: string[]
}

interface DailySummariesClientProps {
  initialDate: string
  initialSummaries: DailySummary[]
}

export default function DailySummariesClient({ 
  initialDate, 
  initialSummaries 
}: DailySummariesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [summaries, setSummaries] = useState<DailySummary[]>(initialSummaries)
  const [loading, setLoading] = useState(false)

  const handleDateChange = async (date: string) => {
    setSelectedDate(date)
    setLoading(true)
    
    // Update URL with new date
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('date', date)
    router.push(`/dashboard/summaries?${params.toString()}`, { scroll: false })
    
    // Fetch new data - query view directly
    const supabase = createClient()
    const { data: viewData, error: viewError } = await supabase
      .from('daily_route_summaries')
      .select('*')
      .eq('session_date', date)
      .order('route_name', { ascending: true })
      .order('session_type', { ascending: true })

    if (!viewError && viewData) {
      // Ensure incident_refs is always an array
      const processedData = viewData.map((item: any) => ({
        ...item,
        incident_refs: Array.isArray(item.incident_refs) 
          ? item.incident_refs.filter((ref: any) => ref !== null && ref !== undefined)
          : []
      }))
      setSummaries(processedData)
    } else if (viewError) {
      console.error('Error fetching summaries from view:', viewError)
      // Fallback: try RPC function
      const { data, error } = await supabase
        .rpc('get_daily_route_summaries', { p_date: date })

      if (!error && data) {
        // Ensure incident_refs is always an array and incident_count is a number
        const processedData = data.map((item: any) => ({
          ...item,
          incident_count: item.incident_count || 0,
          incident_refs: Array.isArray(item.incident_refs) 
            ? item.incident_refs.filter((ref: any) => ref !== null && ref !== undefined)
            : []
        }))
        setSummaries(processedData)
      } else {
        console.error('Error fetching from RPC:', error)
        setSummaries([])
      }
    } else {
      setSummaries([])
    }
    
    setLoading(false)
  }

  const handleExportCSV = () => {
    // Prepare data for CSV export
    const csvData = summaries.map(summary => ({
      'Route Name': summary.route_name,
      'Session Type': summary.session_type,
      'Driver': summary.driver_name,
      'Passenger Assistant': summary.passenger_assistant_name,
      'Start Time': summary.started_at ? formatTime(summary.started_at) : '—',
      'End Time': summary.ended_at ? formatTime(summary.ended_at) : '—',
      'Present': summary.present_count,
      'Absent': summary.absent_count,
      'Late': summary.late_count,
      'Excused': summary.excused_count,
      'Incident Count': summary.incident_count || 0,
      'Incident References': summary.incident_refs.length > 0 ? summary.incident_refs.join('; ') : '—',
    }))

    const filename = `daily-summary-${selectedDate}`
    exportToCSV(filename, csvData)
  }

  return (
    <Card>
      <CardHeader className="bg-blue-900 text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Route Session Summaries
          </CardTitle>
          <div className="flex items-center space-x-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 rounded-md border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              onClick={handleExportCSV}
              disabled={summaries.length === 0 || loading}
              className="bg-blue-700 hover:bg-blue-600 text-white"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <TableSkeleton />
        ) : summaries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No route sessions found for {formatDate(selectedDate)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-800 text-white">
                  <TableHead className="text-white">Route</TableHead>
                  <TableHead className="text-white">Type</TableHead>
                  <TableHead className="text-white">Driver</TableHead>
                  <TableHead className="text-white">PA</TableHead>
                  <TableHead className="text-white">Start</TableHead>
                  <TableHead className="text-white">End</TableHead>
                  <TableHead className="text-white">Present</TableHead>
                  <TableHead className="text-white">Absent</TableHead>
                  <TableHead className="text-white">Incidents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((summary) => (
                  <TableRow 
                    key={summary.route_session_id}
                    className="hover:bg-blue-50"
                  >
                    <TableCell className="font-medium text-gray-900">
                      {summary.route_name}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                        summary.session_type === 'AM' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {summary.session_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {summary.driver_name}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {summary.passenger_assistant_name}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {summary.started_at ? formatTime(summary.started_at) : '—'}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {summary.ended_at ? formatTime(summary.ended_at) : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-green-700 font-medium">
                        {summary.present_count}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${
                        summary.absent_count > 0 ? 'text-red-700' : 'text-gray-500'
                      }`}>
                        {summary.absent_count || '0'}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {summary.incident_count > 0 ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {summary.incident_count} incident{summary.incident_count !== 1 ? 's' : ''}
                          </span>
                          {summary.incident_refs.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {summary.incident_refs.map((incidentId, idx) => (
                                <Link
                                  key={idx}
                                  href={`/dashboard/incidents/${incidentId}`}
                                  className="inline-flex rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                                >
                                  #{incidentId}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

