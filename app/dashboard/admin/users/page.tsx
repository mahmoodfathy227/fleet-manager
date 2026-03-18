'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { RefreshCw, Search, UserPlus, Mail } from 'lucide-react'

type UserRecord = {
  id: number
  full_name: string | null
  email: string
  role: string | null
  approval_status: string | null
  employee_id: number | null
  created_at: string
}

const emptyForm = {
  full_name: '',
  email: '',
  role: 'staff',
  approval_status: 'approved',
  employee_id: '',
}

export default function AdminUsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [formData, setFormData] = useState({ ...emptyForm })
  const [sendingResetForId, setSendingResetForId] = useState<number | null>(null)
  const [resetEmailMessage, setResetEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users
    const term = searchTerm.toLowerCase()
    return users.filter((u) =>
      u.email.toLowerCase().includes(term) ||
      (u.full_name || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term) ||
      (u.approval_status || '').toLowerCase().includes(term)
    )
  }, [searchTerm, users])

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, full_name, email, role, approval_status, employee_id, created_at')
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setUsers((data || []) as UserRecord[])
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const startCreate = () => {
    setFormMode('create')
    setEditingUser(null)
    setFormData({ ...emptyForm })
    setError(null)
    setSuccess(null)
  }

  const startEdit = (user: UserRecord) => {
    setFormMode('edit')
    setEditingUser(user)
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'staff',
      approval_status: user.approval_status || 'approved',
      employee_id: user.employee_id ? String(user.employee_id) : '',
    })
    setError(null)
    setSuccess(null)
  }

  const cancelForm = () => {
    setFormMode(null)
    setEditingUser(null)
    setFormData({ ...emptyForm })
  }

  const handleSendResetPasswordEmail = async (user: UserRecord) => {
    if (!user.email?.trim()) return
    setSendingResetForId(user.id)
    setResetEmailMessage(null)
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
      const { error } = await supabase.auth.resetPasswordForEmail(user.email.trim(), { redirectTo })
      if (error) throw error
      setResetEmailMessage({ type: 'success', text: `Password reset email sent to ${user.email}. They can use the link to set a new password.` })
    } catch (err: any) {
      setResetEmailMessage({ type: 'error', text: err?.message || 'Failed to send reset email. The user may need to sign in with Supabase Auth first.' })
    } finally {
      setSendingResetForId(null)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.email.trim()) {
      setError('Email is required')
      return
    }

    if (!formData.full_name.trim()) {
      setError('Full name is required')
      return
    }

    const rawId = formData.employee_id.trim()
    const parsed = rawId ? Number(formData.employee_id) : NaN
    const employeeId =
      rawId && Number.isInteger(parsed) && parsed > 0 ? parsed : null

    if (rawId && (Number.isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0)) {
      setError('Employee ID must be a positive whole number')
      return
    }

    // If employee ID provided, ensure it exists in the system
    if (employeeId != null) {
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('id', employeeId)
        .maybeSingle()
      if (empError) {
        setError(empError.message || 'Failed to verify employee ID')
        return
      }
      if (!employee) {
        setError("The ID doesn't match employee id in system")
        return
      }
    }

    setSaving(true)
    try {
      if (formMode === 'create') {
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            full_name: formData.full_name.trim(),
            email: formData.email.trim(),
            role: formData.role || 'staff',
            approval_status: formData.approval_status || 'approved',
            employee_id: employeeId,
            password_hash: 'managed_by_admin',
          })
        if (insertError) throw insertError
        setSuccess('User created')
        setFormMode(null)
      }

      if (formMode === 'edit' && editingUser) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            full_name: formData.full_name.trim(),
            email: formData.email.trim(),
            role: formData.role || 'staff',
            approval_status: formData.approval_status || 'approved',
            employee_id: employeeId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingUser.id)
        if (updateError) throw updateError
        setSuccess('User updated')
        setFormMode(null)
      }

      await loadUsers()
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (
        msg.includes('users_employee_id_fkey') ||
        (msg.includes('foreign key') && msg.toLowerCase().includes('employee'))
      ) {
        setError("The ID doesn't match employee id in system")
      } else {
        setError(msg || 'Failed to save user')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-600">View, add, and edit system users.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button size="sm" onClick={startCreate}>
            <UserPlus className="h-4 w-4" />
            <span>Add user</span>
          </Button>
        </div>
      </div>

      {resetEmailMessage && (
        <div className={`rounded-xl border p-3 text-sm ${resetEmailMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
          {resetEmailMessage.text}
        </div>
      )}

      {(formMode || error || success) && (
        <Card>
          <CardHeader>
            <CardTitle>{formMode === 'edit' ? 'Edit user' : 'Add user'}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 border border-rose-100">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-100">
                {success}
              </div>
            )}
            {formMode && (
              <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Select id="role" name="role" value={formData.role} onChange={handleChange}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="approval_status">Approval status</Label>
                  <Select id="approval_status" name="approval_status" value={formData.approval_status} onChange={handleChange}>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employee_id">Employee ID (optional)</Label>
                  <Input id="employee_id" name="employee_id" value={formData.employee_id} onChange={handleChange} />
                </div>
                <div className="flex items-end gap-2 sm:col-span-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : formMode === 'edit' ? 'Save changes' : 'Create user'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={cancelForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Current users</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-slate-500">Loading users…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Employee ID</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={6}>
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b last:border-b-0">
                        <td className="py-3 pr-4 font-medium text-slate-800">
                          {user.full_name || '—'}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{user.email}</td>
                        <td className="py-3 pr-4 text-slate-600">{user.role || '—'}</td>
                        <td className="py-3 pr-4 text-slate-600">{user.approval_status || '—'}</td>
                        <td className="py-3 pr-4 text-slate-600">
                          {user.employee_id ?? '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" onClick={() => startEdit(user)}>
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendResetPasswordEmail(user)}
                              disabled={sendingResetForId === user.id}
                              title="Send password reset email to this user"
                            >
                              <Mail className="h-4 w-4" />
                              {sendingResetForId === user.id ? 'Sending…' : 'Reset password'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

