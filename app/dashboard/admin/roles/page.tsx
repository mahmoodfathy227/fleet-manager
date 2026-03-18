'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { Label } from '@/components/ui/Label'
import { RefreshCw, Search, Check, Shield, Pencil, Plus } from 'lucide-react'

type UserWithRoles = {
  auth_user_id: string
  email: string
  full_name: string
  role_ids: number[]
  role_names: string[]
}

type Role = {
  id: number
  name: string
  description: string | null
}

type Permission = {
  id: number
  key: string
  description: string | null
}

export default function AdminRolesPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<Record<string, number[]>>({})
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [isAddRole, setIsAddRole] = useState(false)
  const [editRoleForm, setEditRoleForm] = useState<{ name: string; description: string; permissionIds: number[] }>({ name: '', description: '', permissionIds: [] })

  const filteredUsers = users.filter((u) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      (u.email || '').toLowerCase().includes(term) ||
      (u.full_name || '').toLowerCase().includes(term) ||
      (u.role_names || []).some((r) => r.toLowerCase().includes(term))
    )
  })

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, rolesRes, permsRes] = await Promise.all([
        supabase.rpc('get_users_with_roles'),
        supabase.from('roles').select('id, name, description').order('name'),
        supabase.from('permissions').select('id, key, description').order('key'),
      ])
      if (usersRes.error) throw usersRes.error
      if (rolesRes.error) throw rolesRes.error
      if (permsRes.error) throw permsRes.error
      setUsers((usersRes.data ?? []) as UserWithRoles[])
      setRoles((rolesRes.data ?? []) as Role[])
      setPermissions((permsRes.data ?? []) as Permission[])
      setSelectedRoleIds({})
      setEditingUserId(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const startEdit = (user: UserWithRoles) => {
    setEditingUserId(user.auth_user_id)
    setSelectedRoleIds((prev) => ({
      ...prev,
      [user.auth_user_id]: [...(user.role_ids || [])],
    }))
    setSuccess(null)
    setError(null)
  }

  const cancelEdit = () => {
    setEditingUserId(null)
    setSelectedRoleIds({})
  }

  const toggleRole = (userId: string, roleId: number) => {
    setSelectedRoleIds((prev) => {
      const current = prev[userId] ?? []
      const has = current.includes(roleId)
      return {
        ...prev,
        [userId]: has ? current.filter((id) => id !== roleId) : [...current, roleId],
      }
    })
  }

  const handleSave = async (userId: string) => {
    setSaving(userId)
    setError(null)
    setSuccess(null)
    try {
      const roleIds = selectedRoleIds[userId] ?? []
      const { error } = await supabase.rpc('set_user_roles', {
        p_user_id: userId,
        p_role_ids: roleIds,
      })
      if (error) throw error
      setSuccess('Roles updated')
      setEditingUserId(null)
      setSelectedRoleIds((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save roles')
    } finally {
      setSaving(null)
    }
  }

  const handleAddRole = () => {
    setError(null)
    setSuccess(null)
    setIsAddRole(true)
    setEditingRole(null)
    setEditRoleForm({ name: '', description: '', permissionIds: [] })
  }

  const handleEditRole = async (role: Role) => {
    setError(null)
    setIsAddRole(false)
    setEditingRole(role)
    try {
      const { data, error: fetchErr } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', role.id)
      if (fetchErr) throw fetchErr
      const permissionIds = (data ?? []).map((r) => r.permission_id)
      setEditRoleForm({
        name: role.name,
        description: role.description || '',
        permissionIds,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load role permissions')
    }
  }

  const toggleRolePermission = (permissionId: number) => {
    setEditRoleForm((prev) => {
      const has = prev.permissionIds.includes(permissionId)
      return {
        ...prev,
        permissionIds: has ? prev.permissionIds.filter((id) => id !== permissionId) : [...prev.permissionIds, permissionId],
      }
    })
  }

  const handleSaveRole = async () => {
    if (!editRoleForm.name.trim()) return
    setSaving('role')
    setError(null)
    setSuccess(null)
    try {
      if (isAddRole) {
        const { data: newRole, error: insertRoleErr } = await supabase
          .from('roles')
          .insert({ name: editRoleForm.name.trim(), description: editRoleForm.description.trim() || null, is_system: false })
          .select('id')
          .single()
        if (insertRoleErr) throw insertRoleErr
        if (!newRole?.id) throw new Error('Failed to create role')

        if (editRoleForm.permissionIds.length > 0) {
          const inserts = editRoleForm.permissionIds.map((permission_id) => ({ role_id: newRole.id, permission_id }))
          const { error: insertErr } = await supabase.from('role_permissions').insert(inserts)
          if (insertErr) throw insertErr
        }

        setSuccess('Role created')
        setIsAddRole(false)
      } else if (editingRole) {
        const { error: updateErr } = await supabase
          .from('roles')
          .update({ name: editRoleForm.name.trim(), description: editRoleForm.description.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', editingRole.id)
        if (updateErr) throw updateErr

        const { error: deleteErr } = await supabase.from('role_permissions').delete().eq('role_id', editingRole.id)
        if (deleteErr) throw deleteErr

        if (editRoleForm.permissionIds.length > 0) {
          const inserts = editRoleForm.permissionIds.map((permission_id) => ({ role_id: editingRole.id, permission_id }))
          const { error: insertErr } = await supabase.from('role_permissions').insert(inserts)
          if (insertErr) throw insertErr
        }

        setSuccess('Role updated')
        setEditingRole(null)
      }
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save role')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, email, or role..."
          className="pl-9"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
            <Shield className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Role Management</h1>
            <p className="text-sm text-slate-500">Assign roles to users. Only Super Admins can manage roles.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {(error || success) && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            error ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
          }`}
        >
          {error || success}
        </div>
      )}

      <Card className="overflow-hidden border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <CardTitle className="text-slate-900 text-base font-semibold">Users & Roles</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-sm text-slate-500 py-8">Loading…</div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Current Roles</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-slate-500">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.auth_user_id} className="hover:bg-slate-50">
                        <TableCell className="font-semibold text-slate-800">
                          {user.full_name || '—'}
                        </TableCell>
                        <TableCell className="text-slate-600">{user.email}</TableCell>
                        <TableCell>
                          {editingUserId === user.auth_user_id ? (
                            <div className="flex flex-wrap gap-2">
                              {roles.map((role) => {
                                const ids = selectedRoleIds[user.auth_user_id] ?? []
                                const checked = ids.includes(role.id)
                                return (
                                  <label
                                    key={role.id}
                                    className="flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleRole(user.auth_user_id, role.id)}
                                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-slate-700">{role.name}</span>
                                  </label>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {(user.role_names || []).length > 0 ? (
                                (user.role_names || []).map((name) => (
                                  <span
                                    key={name}
                                    className="inline-flex items-center rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                                  >
                                    {name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400">No roles assigned</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingUserId === user.auth_user_id ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave(user.auth_user_id)}
                                disabled={saving === user.auth_user_id}
                              >
                                <Check className="h-4 w-4" />
                                {saving === user.auth_user_id ? 'Saving…' : 'Save'}
                              </Button>
                              <Button variant="secondary" size="sm" onClick={cancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-500 hover:text-primary hover:bg-primary/10"
                              onClick={() => startEdit(user)}
                              title="Edit roles"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between">
          <CardTitle className="text-slate-900 text-base font-semibold">Available Roles</CardTitle>
          <Button size="sm" onClick={handleAddRole}>
            <Plus className="h-4 w-4" />
            Add role
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role) => (
              <div
                key={role.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{role.name}</p>
                  {role.description && (
                    <p className="mt-1 text-xs text-slate-600">{role.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-primary hover:bg-primary/10 shrink-0"
                  onClick={() => handleEditRole(role)}
                  title="Edit role"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={!!editingRole || isAddRole}
        onClose={() => { setEditingRole(null); setIsAddRole(false) }}
        title={isAddRole ? 'Add new role' : editingRole ? `Edit role: ${editingRole.name}` : 'Edit role'}
      >
        {(editingRole || isAddRole) && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-role-name">Role name</Label>
              <Input
                id="edit-role-name"
                value={editRoleForm.name}
                onChange={(e) => setEditRoleForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Fleet Access"
                disabled={editingRole?.name === 'Full System Administrator'}
              />
              {editingRole?.name === 'Full System Administrator' && (
                <p className="text-xs text-slate-500">Name cannot be changed (system role)</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role-desc">Description</Label>
              <Input
                id="edit-role-desc"
                value={editRoleForm.description}
                onChange={(e) => setEditRoleForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this role"
              />
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                {permissions.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-100/80 rounded px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={editRoleForm.permissionIds.includes(perm.id)}
                      onChange={() => toggleRolePermission(perm.id)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700">{perm.key}</span>
                    {perm.description && (
                      <span className="text-xs text-slate-500">— {perm.description}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setEditingRole(null); setIsAddRole(false) }}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveRole}
                disabled={saving === 'role' || !editRoleForm.name.trim()}
              >
                {saving === 'role' ? 'Saving…' : isAddRole ? 'Create role' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
