'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FileText } from 'lucide-react'
import TR5Form from './TR5Form'
import TR6Form from './TR6Form'
import TR7Form from './TR7Form'

interface IncidentReportFormsProps {
  incident: {
    id: number
    incident_type: string | null
    description: string | null
    reported_at: string
    location: string | null
    vehicles?: {
      id: number
      vehicle_identifier: string | null
      registration: string | null
      plate_number: string | null
    } | null
    routes?: {
      id: number
      route_number: string | null
    } | null
    route_sessions?: {
      id: number
      session_date: string
      session_type: string
      driver_id: number | null
      passenger_assistant_id: number | null
    } | Array<{
      id: number
      session_date: string
      session_type: string
      driver_id: number | null
      passenger_assistant_id: number | null
    }> | null
    incident_employees?: Array<{
      employees?: {
        id: number
        full_name: string | null
        role: string | null
      } | null
    }>
    incident_passengers?: Array<{
      passengers?: {
        id: number
        full_name: string | null
      } | null
    }>
  }
  driverInfo?: {
    name: string | null
    tasNumber: string | null
  } | null
  paInfo?: {
    name: string | null
    tasNumber: string | null
  } | null
}

type DocumentType = 'TR5' | 'TR6' | 'TR7'

export default function IncidentReportForms({ incident, driverInfo, paInfo }: IncidentReportFormsProps) {
  const [selectedDocument, setSelectedDocument] = useState<DocumentType>('TR5')

  return (
    <div className="space-y-6">
      {/* Document Type Selector + Form content in one card to match incident page */}
      <Card>
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center">
            <FileText className="mr-2 h-4 w-4" />
            Incident Report Forms
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-4">
          <nav className="flex gap-1 border-b border-slate-200 mb-4" aria-label="Form type">
            <button
              onClick={() => setSelectedDocument('TR5')}
              className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors ${
                selectedDocument === 'TR5'
                  ? 'bg-slate-100 text-slate-900 border border-b-0 border-slate-200 border-b-transparent -mb-px'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              TR5 Form
            </button>
            <button
              onClick={() => setSelectedDocument('TR6')}
              className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors ${
                selectedDocument === 'TR6'
                  ? 'bg-slate-100 text-slate-900 border border-b-0 border-slate-200 border-b-transparent -mb-px'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              TR6 Form
            </button>
            <button
              onClick={() => setSelectedDocument('TR7')}
              className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors ${
                selectedDocument === 'TR7'
                  ? 'bg-slate-100 text-slate-900 border border-b-0 border-slate-200 border-b-transparent -mb-px'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              TR7 Form
            </button>
          </nav>

          {/* Document Content - TR5 / TR6 / TR7 forms */}
          {selectedDocument === 'TR5' && (
            <TR5Form
              incident={incident}
              driverInfo={driverInfo}
              paInfo={paInfo}
            />
          )}

          {selectedDocument === 'TR6' && (
            <TR6Form incident={incident} />
          )}

          {selectedDocument === 'TR7' && (
            <TR7Form
              incident={incident}
              driverInfo={driverInfo}
              paInfo={paInfo}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

