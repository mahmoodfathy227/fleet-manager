'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { FileText, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { IncidentPartyEntry } from '@/lib/types'

interface RelatedEmployee {
  id: number
  employee_id: number
  employees?: { id: number; full_name: string; role: string }
}

interface IncidentPartyEntriesProps {
  incidentId: number
  relatedEmployees: RelatedEmployee[]
  initialEntries: IncidentPartyEntry[]
}

export default function IncidentPartyEntries({
  incidentId,
  relatedEmployees,
  initialEntries,
}: IncidentPartyEntriesProps) {
  const supabase = createClient()
  const [entriesByEmployee, setEntriesByEmployee] = useState<Record<number, IncidentPartyEntry>>(() => {
    const map: Record<number, IncidentPartyEntry> = {}
    initialEntries.forEach((e) => {
      map[e.employee_id] = e
    })
    return map
  })
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null)
  const [draftText, setDraftText] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const byEmp: Record<number, IncidentPartyEntry> = {}
    initialEntries.forEach((e) => {
      byEmp[e.employee_id] = e
    })
    setEntriesByEmployee(byEmp)
  }, [initialEntries])

  const startEdit = (employeeId: number) => {
    const existing = entriesByEmployee[employeeId]
    setDraftText((prev) => ({ ...prev, [employeeId]: existing?.entry_text ?? '' }))
    setEditingEmployeeId(employeeId)
    setExpanded((prev) => ({ ...prev, [employeeId]: true }))
  }

  const cancelEdit = () => {
    setEditingEmployeeId(null)
  }

  const saveEntry = async (employeeId: number) => {
    const text = draftText[employeeId] ?? entriesByEmployee[employeeId]?.entry_text ?? ''
    setSaving(employeeId)
    try {
      const existing = entriesByEmployee[employeeId]
      if (existing) {
        const { data, error } = await supabase
          .from('incident_party_entries')
          .update({ entry_text: text })
          .eq('id', existing.id)
          .select()
          .single()
        if (!error && data) {
          setEntriesByEmployee((prev) => ({ ...prev, [employeeId]: data as IncidentPartyEntry }))
        }
      } else {
        const { data, error } = await supabase
          .from('incident_party_entries')
          .insert({ incident_id: incidentId, employee_id: employeeId, entry_text: text })
          .select()
          .single()
        if (!error && data) {
          setEntriesByEmployee((prev) => ({ ...prev, [employeeId]: data as IncidentPartyEntry }))
        }
      }
      setEditingEmployeeId(null)
    } finally {
      setSaving(null)
    }
  }

  if (!relatedEmployees?.length) return null

  return (
    <Card>
      <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center">
          <FileText className="mr-2 h-4 w-4" />
          Party accounts (driver / PA detailed views)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {relatedEmployees.map((ie) => {
            const emp = ie.employees
            const employeeId = ie.employee_id
            const entry = entriesByEmployee[employeeId]
            const isEditing = editingEmployeeId === employeeId
            const isOpen = expanded[employeeId] ?? !!entry
            const roleLabel = emp?.role === 'Driver' ? 'Driver' : emp?.role === 'PA' ? 'Passenger Assistant' : emp?.role || 'Related party'

            return (
              <div
                key={ie.id}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 text-left"
                  onClick={() => setExpanded((prev) => ({ ...prev, [employeeId]: !isOpen }))}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{emp?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{roleLabel}</p>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {isOpen && (
                  <div className="p-4 border-t border-slate-100">
                    {isEditing ? (
                      <div className="space-y-3">
                        <Label htmlFor={`entry-${employeeId}`}>Their account of the incident</Label>
                        <textarea
                          id={`entry-${employeeId}`}
                          className="w-full min-h-[120px] rounded-md border border-slate-300 px-3 py-2 text-sm"
                          value={draftText[employeeId] ?? ''}
                          onChange={(e) =>
                            setDraftText((prev) => ({ ...prev, [employeeId]: e.target.value }))
                          }
                          placeholder="Enter this party’s detailed view of what happened..."
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEntry(employeeId)}
                            disabled={saving === employeeId}
                          >
                            {saving === employeeId ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {entry?.entry_text ? (
                          <div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.entry_text}</p>
                            <p className="text-xs text-slate-400 mt-2">
                              Last updated {formatDateTime(entry.updated_at)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500 italic">No account submitted yet.</p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={() => startEdit(employeeId)}
                        >
                          {entry ? 'Edit account' : 'Add their account'}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
