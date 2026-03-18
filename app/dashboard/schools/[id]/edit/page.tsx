'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'
import { ArrowLeft, Trash2, AlertCircle, UserCog } from 'lucide-react'
import Link from 'next/link'
import { isValidEmail, isValidPhone } from '@/lib/utils'

type Coordinator = { id: number; full_name: string }

function EditSchoolPageClient({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [coordinators, setCoordinators] = useState<Coordinator[]>([])
  const [selectedCoordinatorIds, setSelectedCoordinatorIds] = useState<number[]>([])

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    ref_number: '',
    phone_number: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
  })

  useEffect(() => {
    async function loadSchool() {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching school:', error)
        setError('Failed to load school')
        return
      }

      if (!data) {
        setError('School not found')
        return
      }

      if (data) {
        setFormData({
          name: data.name || '',
          address: data.address || '',
          ref_number: data.ref_number || '',
          phone_number: data.phone_number || '',
          contact_name: data.contact_name || '',
          contact_phone: data.contact_phone || '',
          contact_email: data.contact_email || '',
        })
      }
    }

    loadSchool()
  }, [id, supabase])

  useEffect(() => {
    async function loadCoordinatorsAndAssignments() {
      const [coordsRes, assignmentsRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, full_name')
          .eq('role', 'Coordinator')
          .order('full_name'),
        supabase
          .from('coordinator_school_assignments')
          .select('employee_id')
          .eq('school_id', id),
      ])
      if (coordsRes.data) setCoordinators(coordsRes.data as Coordinator[])
      if (assignmentsRes.data) {
        setSelectedCoordinatorIds(assignmentsRes.data.map((r: { employee_id: number }) => r.employee_id))
      }
    }
    loadCoordinatorsAndAssignments()
  }, [id, supabase])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    setFieldErrors({})

    const errors: Record<string, string> = {}
    if (formData.phone_number.trim() && !isValidPhone(formData.phone_number)) {
      errors.phone_number = 'Please enter a valid phone number (at least 10 digits).'
    }
    if (formData.contact_phone.trim() && !isValidPhone(formData.contact_phone)) {
      errors.contact_phone = 'Please enter a valid phone number (at least 10 digits).'
    }
    if (formData.contact_email.trim() && !isValidEmail(formData.contact_email)) {
      errors.contact_email = 'Please enter a valid email address.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setError('Please correct the phone and email fields.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('schools')
        .update(formData)
        .eq('id', id)

      if (error) throw error

      // Sync coordinator assignments: replace all for this school
      const { error: deleteErr } = await supabase
        .from('coordinator_school_assignments')
        .delete()
        .eq('school_id', id)
      if (deleteErr) throw deleteErr

      if (selectedCoordinatorIds.length > 0) {
        const rows = selectedCoordinatorIds.map((employee_id) => ({
          school_id: parseInt(id, 10),
          employee_id,
        }))
        const { error: insertErr } = await supabase
          .from('coordinator_school_assignments')
          .insert(rows)
        if (insertErr) throw insertErr
      }

      // Audit log (non-blocking)
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'schools',
          record_id: parseInt(id),
          action: 'UPDATE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      router.push(`/dashboard/schools/${id}`)
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
      const { error: deleteErr } = await supabase.from('schools').delete().eq('id', id)

      if (deleteErr) throw deleteErr

      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'schools',
          record_id: parseInt(id),
          action: 'DELETE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      router.push('/dashboard/schools')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {showDeleteConfirm && (
        <ConfirmDeleteCard
          entityName={formData.name || 'this school'}
          items={[
            'The school record',
            'All routes and associated data for this school',
            'All passengers linked to this school',
            'All crew assignments for this school',
            'All route points, sessions, and attendance records',
          ]}
          confirmLabel="Yes, Delete School"
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
        <Link href={`/dashboard/schools/${id}`}>
          <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Edit School</h1>
          <p className="text-sm text-slate-500">Update school information</p>
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
        {/* School Details Section */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">School Information</h2>
        </div>
        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Name + Ref Number */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-medium text-slate-600">School Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Hamilton School"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ref_number" className="text-xs font-medium text-slate-600">Reference Number</Label>
                <Input
                  id="ref_number"
                  value={formData.ref_number}
                  onChange={(e) => setFormData({ ...formData, ref_number: e.target.value })}
                  placeholder="e.g., SCH001"
                  className="h-9"
                />
              </div>
            </div>

            {/* Row 2: Address */}
            <div className="space-y-1">
              <Label htmlFor="address" className="text-xs font-medium text-slate-600">School Address</Label>
              <textarea
                id="address"
                rows={2}
                className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#023E8A] focus:border-transparent"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full school address..."
              />
            </div>

            {/* Row 3: Phone */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="phone_number" className="text-xs font-medium text-slate-600">School Phone</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="e.g., 0121 464 1676"
                  className="h-9"
                />
                {fieldErrors.phone_number && (
                  <p className="text-xs text-red-600">{fieldErrors.phone_number}</p>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Contact Information Section */}
        <div className="border-t border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Contact Information</h2>
        </div>
        <div className="p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="contact_name" className="text-xs font-medium text-slate-600">Contact Name</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="e.g., Sarah Eaton"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact_phone" className="text-xs font-medium text-slate-600">Contact Phone</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="e.g., 0121 464 1676"
                className="h-9"
              />
              {fieldErrors.contact_phone && (
                <p className="text-xs text-red-600">{fieldErrors.contact_phone}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact_email" className="text-xs font-medium text-slate-600">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="e.g., contact@school.edu"
                className="h-9"
              />
              {fieldErrors.contact_email && (
                <p className="text-xs text-red-600">{fieldErrors.contact_email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Coordinators Section */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Coordinators
          </h2>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500 mb-3">Assign one or more coordinators to this school. They will be responsible for this school in the system.</p>
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-slate-50">
            {coordinators.length === 0 ? (
              <p className="text-sm text-slate-500">No coordinators found. Create employees with role Coordinator first.</p>
            ) : (
              coordinators.map((coord) => (
                <label key={coord.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCoordinatorIds.includes(coord.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCoordinatorIds((prev) => [...prev, coord.id])
                      } else {
                        setSelectedCoordinatorIds((prev) => prev.filter((sid) => sid !== coord.id))
                      }
                    }}
                    className="rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]"
                  />
                  <span className="text-sm text-slate-900">{coord.full_name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4">
        <Link href={`/dashboard/schools/${id}`}>
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
            Cancel
          </Button>
        </Link>
        <Button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete School
        </Button>
        <Button onClick={handleSubmit} disabled={loading} className="bg-[#023E8A] hover:bg-[#023E8A]/90 text-white">
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

export default async function EditSchoolPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EditSchoolPageClient id={id} />
}
