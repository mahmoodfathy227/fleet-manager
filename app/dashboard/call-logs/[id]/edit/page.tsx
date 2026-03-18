'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { SearchableMultiSelect } from '@/components/ui/SearchableMultiSelect'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'
import { ArrowLeft, Trash2, AlertCircle, Phone, Users, FileText } from 'lucide-react'
import Link from 'next/link'

function EditCallLogPageClient({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passengers, setPassengers] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [parentContacts, setParentContacts] = useState<{ id: number; full_name: string | null }[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [assistants, setAssistants] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])

  const [formData, setFormData] = useState({
    call_date: '',
    caller_name: '',
    caller_phone: '',
    call_type: 'Inquiry',
    call_to_type: '',
    outgoing_receiver: '',
    outgoing_receiver_other_name: '',
    related_passenger_ids: [] as string[],
    related_driver_ids: [] as string[],
    related_assistant_ids: [] as string[],
    related_employee_ids: [] as string[],
    related_route_id: '',
    subject: '',
    notes: '',
    action_required: false,
    action_taken: '',
    follow_up_required: false,
    follow_up_date: '',
    priority: 'Medium',
    status: 'Open',
  })

  useEffect(() => {
    async function loadData() {
      const [callLogResult, passengersResult, employeesResult, parentContactsResult, driversResult, assistantsResult, routesResult] = await Promise.all([
        supabase.from('call_logs').select('*').eq('id', id).single(),
        supabase.from('passengers').select('id, full_name').order('full_name'),
        supabase.from('employees').select('id, full_name').order('full_name'),
        supabase.from('parent_contacts').select('id, full_name').order('full_name'),
        supabase.from('drivers').select('employee_id, employees(full_name)').order('employee_id'),
        supabase.from('passenger_assistants').select('employee_id, employees(full_name)').order('employee_id'),
        supabase.from('routes').select('id, route_number').order('route_number')
      ])

      if (callLogResult.error) {
        setError('Failed to load call log')
        return
      }

      if (callLogResult.data) {
        const data = callLogResult.data
        setFormData({
          call_date: data.call_date ? new Date(data.call_date).toISOString().slice(0, 16) : '',
          caller_name: data.caller_name || '',
          caller_phone: data.caller_phone || '',
          call_type: data.call_type || 'Inquiry',
          call_to_type: data.call_to_type || '',
          outgoing_receiver: data.outgoing_receiver_parent_contact_id
            ? `parent:${data.outgoing_receiver_parent_contact_id}`
            : data.outgoing_receiver_employee_id
              ? `employee:${data.outgoing_receiver_employee_id}`
              : data.outgoing_receiver_other_name
                ? 'other'
                : '',
          outgoing_receiver_other_name: data.outgoing_receiver_other_name || '',
          related_passenger_ids: data.related_passenger_id ? [String(data.related_passenger_id)] : [],
          related_driver_ids: data.related_driver_id ? [String(data.related_driver_id)] : [],
          related_assistant_ids: data.related_assistant_id ? [String(data.related_assistant_id)] : [],
          related_employee_ids: data.related_employee_id ? [String(data.related_employee_id)] : [],
          related_route_id: data.related_route_id ? String(data.related_route_id) : '',
          subject: data.subject || '',
          notes: data.notes || '',
          action_required: data.action_required || false,
          action_taken: data.action_taken || '',
          follow_up_required: data.follow_up_required || false,
          follow_up_date: data.follow_up_date
            ? (() => {
              const d = new Date(data.follow_up_date)
              if (isNaN(d.getTime())) return ''
              const y = d.getFullYear()
              const m = String(d.getMonth() + 1).padStart(2, '0')
              const day = String(d.getDate()).padStart(2, '0')
              const h = String(d.getHours()).padStart(2, '0')
              const min = String(d.getMinutes()).padStart(2, '0')
              return `${y}-${m}-${day}T${h}:${min}`
            })()
            : '',
          priority: data.priority || 'Medium',
          status: data.status || 'Open',
        })
      }

      if (passengersResult.data) setPassengers(Array.isArray(passengersResult.data) ? passengersResult.data : [])
      if (employeesResult.data) setEmployees(Array.isArray(employeesResult.data) ? employeesResult.data : [])
      if (parentContactsResult.data) setParentContacts(Array.isArray(parentContactsResult.data) ? parentContactsResult.data : [])
      if (routesResult.data) setRoutes(Array.isArray(routesResult.data) ? routesResult.data : [])
      if (driversResult.data) {
        const list = Array.isArray(driversResult.data) ? driversResult.data : []
        setDrivers(list.map((d: any) => {
          const emp = d.employees
          const name = Array.isArray(emp) ? emp[0]?.full_name : emp?.full_name
          return { employee_id: d.employee_id, full_name: name || 'Unknown' }
        }))
      }
      if (assistantsResult.data) {
        const list = Array.isArray(assistantsResult.data) ? assistantsResult.data : []
        setAssistants(list.map((a: any) => {
          const emp = a.employees
          const name = Array.isArray(emp) ? emp[0]?.full_name : emp?.full_name
          return { employee_id: a.employee_id, full_name: name || 'Unknown' }
        }))
      }
      setDataLoaded(true)
    }
    loadData()
  }, [id, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const [receiverParentId, receiverEmployeeId] = (() => {
        const v = formData.outgoing_receiver
        if (!v) return [null, null]
        if (v.startsWith('parent:')) return [parseInt(v.slice(7), 10) || null, null]
        if (v.startsWith('employee:')) return [null, parseInt(v.slice(9), 10) || null]
        return [null, null]
      })()
      const cleanedData = {
        ...formData,
        outgoing_receiver_parent_contact_id: receiverParentId,
        outgoing_receiver_employee_id: receiverEmployeeId,
        outgoing_receiver_other_name:
          formData.outgoing_receiver === 'other'
            ? (formData.outgoing_receiver_other_name.trim() || null)
            : null,
        related_passenger_id: formData.related_passenger_ids.length > 0 ? parseInt(formData.related_passenger_ids[0], 10) : null,
        related_driver_id: formData.related_driver_ids.length > 0 ? parseInt(formData.related_driver_ids[0], 10) : null,
        related_assistant_id: formData.related_assistant_ids.length > 0 ? parseInt(formData.related_assistant_ids[0], 10) : null,
        related_employee_id: formData.related_employee_ids.length > 0 ? parseInt(formData.related_employee_ids[0], 10) : null,
        related_route_id: formData.related_route_id === '' ? null : (parseInt(formData.related_route_id, 10) || null),
        call_to_type: formData.call_to_type === '' ? null : formData.call_to_type,
        follow_up_date: formData.follow_up_date === '' ? null : formData.follow_up_date.replace('T', ' '),
      }
      delete (cleanedData as any).outgoing_receiver
      delete (cleanedData as any).related_passenger_ids
      delete (cleanedData as any).related_driver_ids
      delete (cleanedData as any).related_assistant_ids
      delete (cleanedData as any).related_employee_ids

      const { error } = await supabase.from('call_logs').update(cleanedData).eq('id', id)
      if (error) throw error

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'call_logs', record_id: parseInt(id), action: 'UPDATE' }),
      })

      router.push(`/dashboard/call-logs/${id}`)
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const { error: deleteErr } = await supabase.from('call_logs').delete().eq('id', id)
      if (deleteErr) throw deleteErr

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'call_logs', record_id: parseInt(id), action: 'DELETE' }),
      })

      router.push('/dashboard/call-logs')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      {showDeleteConfirm && (
        <ConfirmDeleteCard
          entityName={formData.subject ? `Call log: ${formData.subject}` : 'this call log'}
          items={[
            'The call log record',
            'All linked passenger, driver, and route references',
            'Subject, notes, and follow-up data',
          ]}
          confirmLabel="Yes, Delete Call Log"
          onConfirm={handleDelete}
          onCancel={() => {
            setShowDeleteConfirm(false)
            setError(null)
          }}
          loading={deleting}
          error={error}
        />
      )}

      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/call-logs/${id}`}>
          <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Edit Call Log</h1>
          <p className="text-sm text-slate-500">Update call log information</p>
        </div>
      </div>

      {error && !showDeleteConfirm && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Caller Information Section */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <Phone className="mr-2 h-4 w-4" />
            Caller Information
          </h2>
        </div>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="call_date" className="text-xs font-medium text-slate-600">Date/Time *</Label>
              <Input id="call_date" type="datetime-local" required value={formData.call_date} onChange={(e) => setFormData({ ...formData, call_date: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caller_name" className="text-xs font-medium text-slate-600">Caller Name *</Label>
              <Input id="caller_name" required value={formData.caller_name} onChange={(e) => setFormData({ ...formData, caller_name: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="caller_phone" className="text-xs font-medium text-slate-600">Phone</Label>
              <Input id="caller_phone" type="tel" value={formData.caller_phone} onChange={(e) => setFormData({ ...formData, caller_phone: e.target.value })} className="h-9" />
            </div>
          </div>
        </div>

        {/* Call Details Section */}
        <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <FileText className="mr-2 h-4 w-4" />
            Call Details
          </h2>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="call_to_type" className="text-xs font-medium text-slate-600">Call To/From *</Label>
                <Select id="call_to_type" required value={formData.call_to_type} onChange={(e) => setFormData({ ...formData, call_to_type: e.target.value })} className="h-9">
                  <option value="">Select...</option>
                  <option value="Staff">Staff</option>
                  <option value="Parent">Parent</option>
                  <option value="Admin">Admin</option>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="outgoing_receiver" className="text-xs font-medium text-slate-600">Outgoing call receiver</Label>
                <SearchableSelect
                  id="outgoing_receiver"
                  options={[
                    ...parentContacts.map((p) => ({ value: `parent:${p.id}`, label: `Parent: ${p.full_name || 'Unknown'}` })),
                    ...employees.map((e) => ({ value: `employee:${e.id}`, label: `Employee: ${e.full_name || 'Unknown'}` })),
                    { value: 'other', label: 'Other (not in system)' },
                  ]}
                  value={formData.outgoing_receiver}
                  onChange={(v) => setFormData({ ...formData, outgoing_receiver: v })}
                  placeholder="Search parent or employee, or choose Other..."
                  emptyLabel="None"
                />
                {formData.outgoing_receiver === 'other' && (
                  <div className="mt-1">
                    <Label htmlFor="outgoing_receiver_other_name" className="text-xs font-medium text-slate-600">
                      Other person&apos;s name
                    </Label>
                    <Input
                      id="outgoing_receiver_other_name"
                      value={formData.outgoing_receiver_other_name}
                      onChange={(e) =>
                        setFormData({ ...formData, outgoing_receiver_other_name: e.target.value })
                      }
                      placeholder="Name of the person you called"
                      className="h-9 mt-0.5"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="call_type" className="text-xs font-medium text-slate-600">Call Type *</Label>
                <Select id="call_type" required value={formData.call_type} onChange={(e) => setFormData({ ...formData, call_type: e.target.value })} className="h-9">
                  <option value="Inquiry">Inquiry</option>
                  <option value="Complaint">Complaint</option>
                  <option value="Incident Report">Incident Report</option>
                  <option value="Schedule Change">Schedule Change</option>
                  <option value="Compliment">Compliment</option>
                  <option value="Other">Other</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="priority" className="text-xs font-medium text-slate-600">Priority</Label>
                <Select id="priority" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="h-9">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="status" className="text-xs font-medium text-slate-600">Status</Label>
                <Select id="status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="h-9">
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="subject" className="text-xs font-medium text-slate-600">Subject *</Label>
              <Input id="subject" required value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} className="h-9" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs font-medium text-slate-600">Call Notes</Label>
                <textarea id="notes" rows={2} className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023E8A] focus:border-transparent" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="action_taken" className="text-xs font-medium text-slate-600">Action Taken</Label>
                <textarea id="action_taken" rows={2} className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023E8A] focus:border-transparent" value={formData.action_taken} onChange={(e) => setFormData({ ...formData, action_taken: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="action_required" checked={formData.action_required} onChange={(e) => setFormData({ ...formData, action_required: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]" />
                <Label htmlFor="action_required" className="text-sm text-slate-600">Action Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="follow_up_required" checked={formData.follow_up_required} onChange={(e) => setFormData({ ...formData, follow_up_required: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]" />
                <Label htmlFor="follow_up_required" className="text-sm text-slate-600">Follow-up Required</Label>
              </div>
              {formData.follow_up_required && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="follow_up_date" className="text-xs text-slate-600">Follow-up Date:</Label>
                  <Input id="follow_up_date" type="datetime-local" value={formData.follow_up_date} onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })} className="h-8 w-48" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Related Entities Section */}
        <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Related Entities
          </h2>
        </div>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="related_passenger_id" className="text-xs font-medium text-slate-600">Passenger</Label>
              {!dataLoaded ? (
                <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">Loading...</div>
              ) : (
                <SearchableMultiSelect
                  id="related_passenger_id"
                  options={passengers.map((p) => ({ value: String(p.id), label: String(p.full_name || 'Unknown') }))}
                  value={formData.related_passenger_ids}
                  onChange={(v) => setFormData({ ...formData, related_passenger_ids: v })}
                  placeholder="Search passengers..."
                  emptyLabel="None"
                />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="related_driver_id" className="text-xs font-medium text-slate-600">Driver</Label>
              {!dataLoaded ? (
                <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">Loading...</div>
              ) : (
                <SearchableMultiSelect
                  id="related_driver_id"
                  options={drivers.map((d) => ({ value: String(d.employee_id), label: String(d.full_name || 'Unknown') }))}
                  value={formData.related_driver_ids}
                  onChange={(v) => setFormData({ ...formData, related_driver_ids: v })}
                  placeholder="Search drivers..."
                  emptyLabel="None"
                />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="related_assistant_id" className="text-xs font-medium text-slate-600">Assistant (PA)</Label>
              {!dataLoaded ? (
                <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">Loading...</div>
              ) : (
                <SearchableMultiSelect
                  id="related_assistant_id"
                  options={assistants.map((a) => ({ value: String(a.employee_id), label: String(a.full_name || 'Unknown') }))}
                  value={formData.related_assistant_ids}
                  onChange={(v) => setFormData({ ...formData, related_assistant_ids: v })}
                  placeholder="Search assistants..."
                  emptyLabel="None"
                />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="related_employee_id" className="text-xs font-medium text-slate-600">Other Employee</Label>
              {!dataLoaded ? (
                <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">Loading...</div>
              ) : (
                <SearchableMultiSelect
                  id="related_employee_id"
                  options={employees.map((e) => ({ value: String(e.id), label: String(e.full_name || 'Unknown') }))}
                  value={formData.related_employee_ids}
                  onChange={(v) => setFormData({ ...formData, related_employee_ids: v })}
                  placeholder="Search employees..."
                  emptyLabel="None"
                />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="related_route_id" className="text-xs font-medium text-slate-600">Route</Label>
              <Select id="related_route_id" value={formData.related_route_id} onChange={(e) => setFormData({ ...formData, related_route_id: e.target.value })} className="h-9">
                <option value="">None</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.route_number || `Route ${r.id}`}</option>)}
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
        <Link href={`/dashboard/call-logs/${id}`}>
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
            Cancel
          </Button>
        </Link>
        <Button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
        <Button onClick={handleSubmit} disabled={loading} className="bg-[#023E8A] hover:bg-[#023E8A]/90 text-white">
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

export default async function EditCallLogPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EditCallLogPageClient id={id} />
}
