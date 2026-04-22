'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ArrowLeft, Plus, Clock } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { daysFromTodayToExpiryDate, formatDaysFromTodayLabel } from '@/lib/expiryRelativeToToday'

interface Notification {
  id: number
  status?: string
  admin_response_required?: boolean
  certificate_name: string
  entity_type: string
  entity_id: number
  expiry_date: string
  days_until_expiry: number
  recipient?: { full_name: string }
}

interface CaseUpdate {
  id: number
  update_type: string
  notes: string | null
  created_at: string
}

interface CaseRow {
  id: number
  notification_id: number
  application_status: string
  date_applied: string | null
  appointment_date: string | null
  notifications: Notification | null
}

interface ComplianceCaseDetailClientProps {
  caseId: number
  initialCase: CaseRow | null
  initialUpdates: CaseUpdate[]
}

export function ComplianceCaseDetailClient({
  caseId,
  initialCase: initialCaseProp,
  initialUpdates: initialUpdatesProp,
}: ComplianceCaseDetailClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const caseRow = initialCaseProp
  const [updates, setUpdates] = useState<CaseUpdate[]>(initialUpdatesProp)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  /*
   * Hidden for now (restore when needed):
   * - "Tracking Actions" card (application status, applied date, appointment, Save)
   * - "Reminder" card (mark paperwork done / approve)
   * Related state/handlers were: applicationStatus, dateApplied, appointmentDate, saving,
   * markingDone, handleSaveTracking, handleMarkPaperworkDone, and the caseRow→form useEffect.
   */

  useEffect(() => {
    console.debug('[fleet] ComplianceCaseDetailClient: "From today" uses daysFromTodayToExpiryDate(expiry_date)')
    console.debug('[fleet] ComplianceCaseDetailClient: visible sections = Details + Updates & Activity Log only')
  }, [])

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.trim()) return
    setAddingNote(true)
    try {
      const { data, error } = await supabase
        .from('compliance_case_updates')
        .insert({ case_id: caseId, update_type: 'note', notes: newNote.trim() })
        .select('id, update_type, notes, created_at')
        .single()

      if (error) throw error
      setUpdates((prev) => [{ ...data }, ...prev])
      setNewNote('')
      router.refresh()
    } catch (e: any) {
      alert(e.message || 'Failed to add update')
    } finally {
      setAddingNote(false)
    }
  }

  const notif = caseRow?.notifications
  const getEntityLink = () => {
    if (!notif) return '#'
    if (notif.entity_type === 'vehicle') return `/dashboard/vehicles/${notif.entity_id}`
    if (notif.entity_type === 'driver' || notif.entity_type === 'assistant') return `/dashboard/employees/${notif.entity_id}`
    return '#'
  }

  if (!caseRow) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-8 text-center text-slate-500">
          Update not found.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/compliance/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to updates
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-4">
              <CardTitle className="text-base font-semibold text-slate-800">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Certificate</span>
                  <span className="text-sm font-semibold text-slate-800 text-right">{notif?.certificate_name || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Entity</span>
                  <div className="text-right">
                    <Link href={getEntityLink()} className="text-sm text-primary hover:underline font-medium block">
                      {notif?.entity_type} #{notif?.entity_id}
                    </Link>
                    {notif?.recipient && (
                      <span className="text-xs text-slate-500 block">{(notif.recipient as any)?.full_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Expiry</span>
                  <span className="text-sm text-slate-800">{notif?.expiry_date ? formatDate(notif.expiry_date) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">From today</span>
                  <span
                    className={`text-sm font-medium ${
                      notif?.expiry_date && daysFromTodayToExpiryDate(notif.expiry_date) < 0 ? 'text-red-600' : 'text-slate-800'
                    }`}
                  >
                    {notif?.expiry_date ? formatDaysFromTodayLabel(daysFromTodayToExpiryDate(notif.expiry_date)) : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 h-full">
          <Card className="border-slate-200 shadow-sm h-full flex flex-col">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-4 flex flex-row items-center justify-between shrink-0">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Updates & Activity Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-col flex-1 gap-4 h-[600px]">
              <form onSubmit={handleAddUpdate} className="flex gap-2 shrink-0">
                <Input
                  placeholder="Type a new note or update..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="flex-1 h-9"
                />
                <Button type="submit" disabled={addingNote || !newNote.trim()} size="sm" className="bg-[#023E8A] hover:bg-[#023E8A]/90">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </form>

              <div className="flex-1 overflow-y-auto pr-1">
                <ul className="space-y-3">
                  {updates.length === 0 ? (
                    <li className="text-sm text-slate-500 py-8 text-center italic border-2 border-dashed border-slate-100 rounded-lg">
                      No updates recorded yet. Start the conversation above.
                    </li>
                  ) : (
                    updates.map((u) => (
                      <li key={u.id} className="group flex gap-3 p-3 bg-white hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors shadow-sm">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{u.notes || u.update_type}</p>
                          <p className="text-[10px] text-slate-400 mt-1.5 font-medium flex items-center gap-1">
                            {formatDateTime(u.created_at)}
                            <span className="w-1 h-1 rounded-full bg-slate-300 mx-1"></span>
                            System
                          </p>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
