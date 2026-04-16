'use client'

import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FileText } from 'lucide-react'
import TR5Form, { type TR5FormHandle } from './TR5Form'
import TR6Form, { type TR6FormHandle } from './TR6Form'
import TR7Form, { type TR7FormHandle } from './TR7Form'

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
        schools?: { name: string | null } | null
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
  /** When true, all three TR forms stay mounted (hidden) so refs capture full draft; save/export disabled in children. */
  isDraft?: boolean
}

export type IncidentReportFormsHandle = {
  getTr5Payload: () => Record<string, unknown> | null
  getTr6Payload: () => Record<string, unknown> | null
  getTr7Payload: () => Record<string, unknown> | null
}

type DocumentType = 'TR5' | 'TR6' | 'TR7'

const IncidentReportForms = forwardRef<IncidentReportFormsHandle, IncidentReportFormsProps>(
  function IncidentReportForms({ incident, driverInfo, paInfo, isDraft = false }, ref) {
    const [selectedDocument, setSelectedDocument] = useState<DocumentType>('TR5')
    const tr5Ref = useRef<TR5FormHandle>(null)
    const tr6Ref = useRef<TR6FormHandle>(null)
    const tr7Ref = useRef<TR7FormHandle>(null)

    useImperativeHandle(ref, () => ({
      getTr5Payload: () => tr5Ref.current?.getFormPayload() ?? null,
      getTr6Payload: () => tr6Ref.current?.getFormPayload() ?? null,
      getTr7Payload: () => tr7Ref.current?.getFormPayload() ?? null,
    }))

    useEffect(() => {
      if (isDraft) {
        console.debug(
          '[IncidentReportForms] draft: TR5/6/7 Save/Export use each form’s required fields; no draftSaveAllowed'
        )
      }
    }, [isDraft])

    useEffect(() => {
      if (isDraft) console.debug('[IncidentReportForms] draft: active tab', selectedDocument)
    }, [isDraft, selectedDocument])

    return (
      <div className="space-y-6">
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
                type="button"
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
                type="button"
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
                type="button"
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

            {isDraft ? (
              <>
                <div className={selectedDocument !== 'TR5' ? 'hidden' : ''} aria-hidden={selectedDocument !== 'TR5'}>
                  <TR5Form
                    ref={tr5Ref}
                    incident={incident}
                    driverInfo={driverInfo}
                    paInfo={paInfo}
                    isDraft
                  />
                </div>
                <div className={selectedDocument !== 'TR6' ? 'hidden' : ''} aria-hidden={selectedDocument !== 'TR6'}>
                  <TR6Form ref={tr6Ref} incident={incident} isDraft />
                </div>
                <div className={selectedDocument !== 'TR7' ? 'hidden' : ''} aria-hidden={selectedDocument !== 'TR7'}>
                  <TR7Form
                    ref={tr7Ref}
                    incident={incident}
                    driverInfo={driverInfo}
                    paInfo={paInfo}
                    isDraft
                  />
                </div>
              </>
            ) : (
              <>
                {selectedDocument === 'TR5' && (
                  <TR5Form incident={incident} driverInfo={driverInfo} paInfo={paInfo} />
                )}
                {selectedDocument === 'TR6' && <TR6Form incident={incident} />}
                {selectedDocument === 'TR7' && (
                  <TR7Form incident={incident} driverInfo={driverInfo} paInfo={paInfo} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }
)

export default IncidentReportForms
