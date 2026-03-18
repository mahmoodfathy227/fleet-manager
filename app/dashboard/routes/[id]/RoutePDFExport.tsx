'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { FileDown, Loader2 } from 'lucide-react'
import { exportToPDF } from '@/lib/utils/pdfExport'
import { formatDate } from '@/lib/utils'

interface RoutePDFExportProps {
  routeId: number
  routeNumber: string | null
}

export default function RoutePDFExport({ routeId, routeNumber }: RoutePDFExportProps) {
  const [loading, setLoading] = useState(false)

  const handleExportPDF = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Fetch all route sessions for this route
      const { data: sessions, error: sessionsError } = await supabase
        .from('route_sessions')
        .select(`
          id,
          session_date,
          session_type,
          driver_id,
          passenger_assistant_id,
          routes(route_number),
          driver:driver_id(employees(full_name)),
          pa:passenger_assistant_id(employees(full_name))
        `)
        .eq('route_id', routeId)
        .order('session_date', { ascending: false })
        .order('session_type', { ascending: true })

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError)
        alert('Error loading route sessions')
        setLoading(false)
        return
      }

      // Fetch all incidents for sessions in this route
      const sessionIds = sessions?.map((s: any) => s.id) || []
      let allIncidents: any[] = []
      if (sessionIds.length > 0) {
        const { data: incidents, error: incidentsError } = await supabase
          .from('incidents')
          .select('id, incident_type, description, reported_at, resolved, reference_number, route_session_id')
          .in('route_session_id', sessionIds)
          .order('reported_at', { ascending: false })

        if (!incidentsError && incidents) {
          allIncidents = incidents
        }
      }

      // Also get incidents linked directly to route
      const { data: routeIncidents, error: routeIncidentsError } = await supabase
        .from('incidents')
        .select('id, incident_type, description, reported_at, resolved, reference_number, route_session_id')
        .eq('route_id', routeId)
        .is('route_session_id', null)
        .order('reported_at', { ascending: false })

      if (!routeIncidentsError && routeIncidents) {
        allIncidents = [...allIncidents, ...routeIncidents]
      }

      // Fetch all documents for sessions in this route
      let allDocuments: any[] = []
      if (sessionIds.length > 0) {
        const { data: documents, error: documentsError } = await supabase
          .from('documents')
          .select('id, doc_type, file_name, file_url, uploaded_at, route_session_id')
          .in('route_session_id', sessionIds)
          .order('uploaded_at', { ascending: false })

        if (!documentsError && documents) {
          allDocuments = documents
        }
      }

      // Group incidents and documents by session
      const sessionsWithData = (sessions || []).map((session: any) => {
        const sessionIncidents = allIncidents.filter(
          (inc: any) => inc.route_session_id === session.id
        )
        const sessionDocuments = allDocuments.filter(
          (doc: any) => doc.route_session_id === session.id
        )

        return {
          session,
          incidents: sessionIncidents,
          documents: sessionDocuments,
        }
      })

      // Also include route-level incidents (not linked to a session)
      const routeLevelIncidents = allIncidents.filter(
        (inc: any) => !inc.route_session_id
      )

      // Generate PDF for each session that has incidents or documents
      let exportedCount = 0
      for (const sessionData of sessionsWithData) {
        if (sessionData.incidents.length > 0 || sessionData.documents.length > 0) {
          await exportToPDF({
            title: `Route ${routeNumber || routeId} - ${formatDate(sessionData.session.session_date)} ${sessionData.session.session_type}`,
            incidents: sessionData.incidents,
            documents: sessionData.documents,
            routeInfo: {
              route_number: sessionData.session.routes?.route_number || routeNumber,
              session_date: sessionData.session.session_date,
              session_type: sessionData.session.session_type,
              driver_name: sessionData.session.driver?.employees?.full_name || 'Unassigned',
              passenger_assistant_name: sessionData.session.pa?.employees?.full_name || 'Unassigned',
            },
          })
          exportedCount++
          // Small delay between exports to avoid browser blocking
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      // Export route-level incidents if any
      if (routeLevelIncidents.length > 0) {
        await exportToPDF({
          title: `Route ${routeNumber || routeId} - Route-Level Incidents`,
          incidents: routeLevelIncidents,
          routeInfo: {
            route_number: routeNumber || `Route ${routeId}`,
            session_date: new Date().toISOString().split('T')[0],
            session_type: 'N/A',
            driver_name: 'N/A',
            passenger_assistant_name: 'N/A',
          },
        })
        exportedCount++
      }

      if (exportedCount === 0) {
        alert('No incidents or documents found for this route')
      } else {
        alert(`Exported ${exportedCount} PDF file(s)`)
      }
    } catch (error: any) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleExportPDF}
      disabled={loading}
      variant="secondary"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          Export PDF
        </>
      )}
    </Button>
  )
}

