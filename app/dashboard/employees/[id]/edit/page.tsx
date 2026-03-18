'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
function EditEmployeePageClient({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [badgePhotoFile, setBadgePhotoFile] = useState<File | null>(null)
  const [existingBadgePhotoUrl, setExistingBadgePhotoUrl] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    full_name: '',
    role: '',
    employment_status: 'Active',
    phone_number: '',
    personal_email: '',
    address: '',
    next_of_kin: '',
    date_of_birth: '',
    start_date: '',
    end_date: '',
  })
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([])
  const [assignedSchoolIds, setAssignedSchoolIds] = useState<number[]>([])

  useEffect(() => {
    async function loadEmployee() {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        setError('Failed to load employee')
        return
      }

      if (data) {
        // Format dates for date input (YYYY-MM-DD format)
        const formatDateForInput = (dateString: string | null): string => {
          if (!dateString) return ''
          try {
            const date = new Date(dateString)
            if (isNaN(date.getTime())) return ''
            return date.toISOString().split('T')[0]
          } catch {
            return ''
          }
        }

        setFormData({
          full_name: data.full_name || '',
          role: data.role || '',
          employment_status: data.employment_status || 'Active',
          phone_number: data.phone_number || '',
          personal_email: data.personal_email || '',
          address: data.address || '',
          next_of_kin: data.next_of_kin || '',
          date_of_birth: formatDateForInput(data.date_of_birth),
          start_date: formatDateForInput(data.start_date),
          end_date: formatDateForInput(data.end_date),
        })

        // Load coordinator school assignments if Coordinator
        if (data.role === 'Coordinator') {
          const { data: assignments } = await supabase
            .from('coordinator_school_assignments')
            .select('school_id')
            .eq('employee_id', parseInt(id))
          if (assignments && assignments.length > 0) {
            setAssignedSchoolIds(assignments.map((a) => a.school_id))
          }
        }

        // Load existing badge photo from documents table
        const { data: badgePhotoDocs, error: docError } = await supabase
          .from('documents')
          .select('file_url, file_path')
          .eq('employee_id', parseInt(id))
          .eq('doc_type', 'ID Badge Photo')
          .order('uploaded_at', { ascending: false })
          .limit(1)

        if (!docError && badgePhotoDocs && badgePhotoDocs.length > 0) {
          const badgePhotoDoc = badgePhotoDocs[0]
          // Use file_url if available, otherwise get public URL from file_path
          if (badgePhotoDoc.file_url) {
            setExistingBadgePhotoUrl(badgePhotoDoc.file_url)
          } else if (badgePhotoDoc.file_path) {
            const { data: { publicUrl } } = supabase.storage
              .from('EMPLOYEE_DOCUMENTS')
              .getPublicUrl(badgePhotoDoc.file_path)
            setExistingBadgePhotoUrl(publicUrl)
          }
        }
      }
    }

    loadEmployee()
  }, [id, supabase])

  useEffect(() => {
    async function loadSchools() {
      const sb = createClient()
      const { data } = await sb.from('schools').select('id, name').order('name')
      if (data) setSchools(data)
    }
    loadSchools()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate dates
      let startDate: string | null = formData.start_date.trim() || null
      let endDate: string | null = formData.end_date.trim() || null

      // Validate date formats if provided
      if (startDate) {
        const startDateObj = new Date(startDate)
        if (isNaN(startDateObj.getTime())) {
          throw new Error('Start Date: Please enter a valid date (YYYY-MM-DD format)')
        }
      }

      if (endDate) {
        const endDateObj = new Date(endDate)
        if (isNaN(endDateObj.getTime())) {
          throw new Error('End Date: Please enter a valid date (YYYY-MM-DD format)')
        }

        // Validate that end date is after start date if both are provided
        if (startDate) {
          const startDateObj = new Date(startDate)
          const endDateObj = new Date(endDate)
          if (endDateObj < startDateObj) {
            throw new Error('End Date must be after or equal to Start Date')
          }
        }
      }

      // Prepare data for update
      const dateOfBirth = formData.date_of_birth.trim() || null
      if (dateOfBirth) {
        const dobObj = new Date(dateOfBirth)
        if (isNaN(dobObj.getTime())) {
          throw new Error('Date of Birth: Please enter a valid date (YYYY-MM-DD format)')
        }
      }

      const updateData: any = {
        full_name: formData.full_name,
        role: formData.role || null,
        employment_status: formData.employment_status,
        phone_number: formData.phone_number || null,
        personal_email: formData.personal_email || null,
        address: formData.address || null,
        next_of_kin: formData.next_of_kin.trim() || null,
        date_of_birth: dateOfBirth,
        start_date: startDate,
        end_date: endDate,
      }

      const { error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', id)

      if (error) {
        // Provide clearer error messages
        if (error.message.includes('date') || error.message.includes('invalid input')) {
          if (error.message.includes('start_date')) {
            throw new Error('Start Date: Invalid date format. Please use YYYY-MM-DD format or leave blank.')
          } else if (error.message.includes('end_date')) {
            throw new Error('End Date: Invalid date format. Please use YYYY-MM-DD format or leave blank.')
          } else {
            throw new Error('Date Error: Please check your date fields. Use YYYY-MM-DD format or leave blank.')
          }
        }
        throw error
      }

      // Upload badge photo if provided
      if (badgePhotoFile) {
        const fileExt = badgePhotoFile.name.split('.').pop()
        const fileName = `employees/${id}/badge_photo_${Date.now()}.${fileExt}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('EMPLOYEE_DOCUMENTS')
          .upload(fileName, badgePhotoFile)

        if (uploadError) {
          console.error('Error uploading badge photo:', uploadError)
          // Continue even if upload fails
        } else if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('EMPLOYEE_DOCUMENTS')
            .getPublicUrl(fileName)

          // Save to documents table
          const { error: docError } = await supabase.from('documents').insert({
            employee_id: parseInt(id),
            file_name: badgePhotoFile.name,
            file_type: badgePhotoFile.type || 'image/jpeg',
            file_path: fileName,
            file_url: publicUrl,
            doc_type: 'ID Badge Photo',
            uploaded_by: null,
          })
          if (docError) {
            console.error('Error saving badge photo document:', docError)
          }
        }
      }

      // Update coordinator school assignments if Coordinator
      if (formData.role === 'Coordinator') {
        await supabase.from('coordinator_school_assignments').delete().eq('employee_id', parseInt(id))
        if (assignedSchoolIds.length > 0) {
          await supabase.from('coordinator_school_assignments').insert(
            assignedSchoolIds.map((schoolId) => ({ employee_id: parseInt(id), school_id: schoolId }))
          )
        }
      } else {
        // If role changed away from Coordinator, remove all assignments
        await supabase.from('coordinator_school_assignments').delete().eq('employee_id', parseInt(id))
      }

      // Log audit
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'employees',
          record_id: parseInt(id),
          action: 'UPDATE',
        }),
      })

      router.push(`/dashboard/employees/${id}`)
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
      const { error: deleteErr } = await supabase.from('employees').delete().eq('id', id)

      if (deleteErr) throw deleteErr

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'employees',
          record_id: parseInt(id),
          action: 'DELETE',
        }),
      })

      router.push('/dashboard/employees')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {showDeleteConfirm && (
        <ConfirmDeleteCard
          entityName={formData.full_name || 'this employee'}
          items={[
            'The employee record',
            'Related driver or passenger assistant record (if any)',
            'All documents and certificates linked to this employee',
            'All route and assignment links',
          ]}
          confirmLabel="Yes, Delete Employee"
          onConfirm={handleDelete}
          onCancel={() => {
            setShowDeleteConfirm(false)
            setError(null)
          }}
          loading={deleting}
          error={error}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/dashboard/employees/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Employee</h1>
            <p className="mt-2 text-sm text-gray-600">
              Update employee information
            </p>
          </div>
        </div>
        <Button
          variant="danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  required
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  id="role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                >
                  <option value="">Select role</option>
                  <option value="Driver">Driver</option>
                  <option value="PA">Passenger Assistant</option>
                  <option value="Coordinator">Coordinator</option>
                  <option value="Admin">Admin</option>
                  <option value="Other">Other</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employment_status">Employment Status</Label>
                <Select
                  id="employment_status"
                  value={formData.employment_status}
                  onChange={(e) =>
                    setFormData({ ...formData, employment_status: e.target.value })
                  }
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) =>
                    setFormData({ ...formData, phone_number: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personal_email">Personal Email</Label>
                <Input
                  id="personal_email"
                  type="email"
                  value={formData.personal_email}
                  onChange={(e) =>
                    setFormData({ ...formData, personal_email: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Full address..."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="next_of_kin">Next of Kin</Label>
                <Input
                  id="next_of_kin"
                  value={formData.next_of_kin}
                  onChange={(e) =>
                    setFormData({ ...formData, next_of_kin: e.target.value })
                  }
                  placeholder="Name and/or contact details..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) =>
                    setFormData({ ...formData, date_of_birth: e.target.value })
                  }
                  max="9999-12-31"
                />
                <p className="text-xs text-gray-500">Optional</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  max="9999-12-31"
                />
                <p className="text-xs text-gray-500">Optional - Leave blank if not applicable</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  max="9999-12-31"
                />
                <p className="text-xs text-gray-500">Optional - Leave blank if employee is still active</p>
              </div>

              {formData.role === 'Coordinator' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Assigned Schools</Label>
                  <p className="text-xs text-gray-500 mb-2">Select the school(s) this coordinator is responsible for. A school can have multiple coordinators.</p>
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-gray-50">
                    {schools.length === 0 ? (
                      <p className="text-sm text-gray-500">No schools found.</p>
                    ) : (
                      schools.map((school) => (
                        <label key={school.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignedSchoolIds.includes(school.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignedSchoolIds((prev) => [...prev, school.id])
                              } else {
                                setAssignedSchoolIds((prev) => prev.filter((sid) => sid !== school.id))
                              }
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-gray-900">{school.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="badge_photo">Badge Photo</Label>
                {existingBadgePhotoUrl && !badgePhotoFile && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-600 mb-2">Current badge photo:</p>
                    <div className="relative inline-block">
                      <img
                        src={existingBadgePhotoUrl}
                        alt="Current badge photo"
                        className="h-32 w-32 rounded-lg object-cover border-2 border-primary shadow-lg shadow-primary/25"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  </div>
                )}
                {badgePhotoFile && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-600 mb-2">New badge photo (will replace current):</p>
                    <div className="relative inline-block">
                      <img
                        src={URL.createObjectURL(badgePhotoFile)}
                        alt="New badge photo preview"
                        className="h-32 w-32 rounded-lg object-cover border-2 border-primary shadow-primary/25"
                      />
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  id="badge_photo"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => setBadgePhotoFile(e.target.files?.[0] || null)}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                />
                <p className="text-xs text-gray-500">Upload a photo for the employee's ID badge (JPG, PNG). {existingBadgePhotoUrl && !badgePhotoFile && 'Select a new file to replace the current photo.'}</p>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Link href={`/dashboard/employees/${id}`}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EditEmployeePageClient id={id} />
}

