'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { RefreshCw, Search, Copy, Pencil, Power, Trash2, Plus } from 'lucide-react'

type DocumentRequirement = {
  id: string
  name: string
  code: string | null
  subject_type: string
  requires_expiry: boolean
  requires_upload: boolean
  requires_number: boolean
  criticality: string
  default_validity_days: number | null
  renewal_notice_days: number | null
  is_required: boolean
  is_active: boolean
  icon_path: string | null
  color: string | null
  updated_at: string
}

const emptyForm = {
  name: '',
  code: '',
  subject_type: 'driver',
  requires_expiry: false,
  requires_upload: false,
  requires_number: false,
  criticality: 'recommended',
  default_validity_days: '',
  renewal_notice_days: '30',
  is_required: true,
  is_active: true,
  icon_path: '',
  color: '',
}

const slugifyCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

export default function DocumentRequirementsPage() {
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterCriticality, setFilterCriticality] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [filterRequired, setFilterRequired] = useState('')
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<DocumentRequirement | null>(null)
  const [formData, setFormData] = useState({ ...emptyForm })
  const [autoCode, setAutoCode] = useState(true)
  const isCodeFocused = useRef(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return requirements
    const term = search.toLowerCase()
    return requirements.filter((r) =>
      r.name.toLowerCase().includes(term) ||
      (r.code || '').toLowerCase().includes(term)
    )
  }, [requirements, search])

  const loadRequirements = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterSubject) params.set('subject_type', filterSubject)
      if (filterCriticality) params.set('criticality', filterCriticality)
      if (filterActive) params.set('is_active', filterActive)
      if (filterRequired) params.set('is_required', filterRequired)
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/document-requirements?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load requirements')
      setRequirements(data.requirements || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load requirements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequirements()
  }, [])

  const startCreate = () => {
    setFormMode('create')
    setEditing(null)
    setFormData({ ...emptyForm })
    setAutoCode(true)
    setError(null)
    setSuccess(null)
  }

  const startEdit = (req: DocumentRequirement) => {
    setFormMode('edit')
    setEditing(req)
    setFormData({
      name: req.name || '',
      code: req.code || '',
      subject_type: req.subject_type || 'driver',
      requires_expiry: !!req.requires_expiry,
      requires_upload: !!req.requires_upload,
      requires_number: !!req.requires_number,
      criticality: req.criticality || 'recommended',
      default_validity_days: req.default_validity_days?.toString() || '',
      renewal_notice_days: req.renewal_notice_days?.toString() || '30',
      is_required: !!req.is_required,
      is_active: !!req.is_active,
      icon_path: req.icon_path || '',
      color: req.color || '',
    })
    setAutoCode(false)
    setError(null)
    setSuccess(null)
  }

  const startDuplicate = (req: DocumentRequirement) => {
    setFormMode('create')
    setEditing(null)
    setFormData({
      ...emptyForm,
      name: `${req.name} Copy`,
      subject_type: req.subject_type,
      requires_expiry: req.requires_expiry,
      requires_upload: req.requires_upload,
      requires_number: req.requires_number,
      criticality: req.criticality,
      default_validity_days: req.default_validity_days?.toString() || '',
      renewal_notice_days: req.renewal_notice_days?.toString() || '30',
      is_required: req.is_required,
      is_active: req.is_active,
      icon_path: req.icon_path || '',
      color: req.color || '',
      code: '',
    })
    setAutoCode(true)
  }

  const cancelForm = () => {
    setFormMode(null)
    setEditing(null)
    setFormData({ ...emptyForm })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    
    // If user is editing the code field, disable auto-code generation
    if (name === 'code') {
      setAutoCode(false)
    }
    
    setFormData((prev) => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value }
      // Only auto-generate code if autoCode is enabled AND user is editing the name field
      // Don't overwrite code if user is currently editing it (focused)
      if (name === 'name' && autoCode && !isCodeFocused.current) {
        next.code = slugifyCode(String(value))
      }
      return next
    })
  }

  const validateForm = () => {
    if (!formData.name.trim()) return 'Name is required'
    if (!formData.subject_type) return 'Subject type is required'
    if (formData.color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(formData.color)) {
      return 'Color must be a valid hex value'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const validation = validateForm()
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...formData,
        code: formData.code ? formData.code.trim() : null,
        default_validity_days: formData.default_validity_days ? Number(formData.default_validity_days) : null,
        renewal_notice_days: formData.requires_expiry
          ? Number(formData.renewal_notice_days || 30)
          : null,
        icon_path: formData.icon_path || null,
        color: formData.color || null,
      }
      const res = await fetch(
        formMode === 'edit' && editing ? `/api/admin/document-requirements/${editing.id}` : '/api/admin/document-requirements',
        {
          method: formMode === 'edit' ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save requirement')
      setSuccess(formMode === 'edit' ? 'Requirement updated' : 'Requirement created')
      setFormMode(null)
      await loadRequirements()
    } catch (err: any) {
      setError(err.message || 'Failed to save requirement')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (req: DocumentRequirement) => {
    try {
      const res = await fetch(`/api/admin/document-requirements/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !req.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      await loadRequirements()
    } catch (err: any) {
      setError(err.message || 'Failed to update requirement')
    }
  }

  const deleteRequirement = async (req: DocumentRequirement) => {
    if (!confirm('Delete this requirement?')) return
    try {
      const res = await fetch(`/api/admin/document-requirements/${req.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete requirement')
      await loadRequirements()
    } catch (err: any) {
      setError(err.message || 'Failed to delete requirement')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Document Requirements</h1>
          <p className="text-sm text-slate-600">Manage document templates and rules.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadRequirements} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4" />
            <span>Add requirement</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or code"
              className="pl-9"
            />
          </div>
          <Select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">All subjects</option>
            <option value="driver">Driver</option>
            <option value="pa">PA</option>
            <option value="vehicle">Vehicle</option>
            <option value="employee">Employee</option>
          </Select>
          <Select value={filterCriticality} onChange={(e) => setFilterCriticality(e.target.value)}>
            <option value="">All criticality</option>
            <option value="critical">Critical</option>
            <option value="recommended">Recommended</option>
            <option value="optional">Optional</option>
          </Select>
          <Select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
            <option value="">Active status</option>
            <option value="true">Active</option>
            <option value="false">Disabled</option>
          </Select>
          <Select value={filterRequired} onChange={(e) => setFilterRequired(e.target.value)}>
            <option value="">Required status</option>
            <option value="true">Required</option>
            <option value="false">Optional</option>
          </Select>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button variant="secondary" size="sm" onClick={loadRequirements}>
              Apply filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {(formMode || error || success) && (
        <Card>
          <CardHeader>
            <CardTitle>{formMode === 'edit' ? 'Edit requirement' : 'New requirement'}</CardTitle>
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
              <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="code">Code</Label>
                  <Input 
                    id="code" 
                    name="code" 
                    value={formData.code} 
                    onChange={handleChange}
                    onFocus={() => { isCodeFocused.current = true }}
                    onBlur={() => { isCodeFocused.current = false }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject_type">Subject type</Label>
                  <Select id="subject_type" name="subject_type" value={formData.subject_type} onChange={handleChange}>
                    <option value="driver">Driver</option>
                    <option value="pa">PA</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="employee">Employee</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="criticality">Criticality</Label>
                  <Select id="criticality" name="criticality" value={formData.criticality} onChange={handleChange}>
                    <option value="critical">Critical</option>
                    <option value="recommended">Recommended</option>
                    <option value="optional">Optional</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="requires_expiry">Requires expiry</Label>
                  <input
                    id="requires_expiry"
                    name="requires_expiry"
                    type="checkbox"
                    checked={formData.requires_expiry}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="requires_upload">Requires upload</Label>
                  <input
                    id="requires_upload"
                    name="requires_upload"
                    type="checkbox"
                    checked={formData.requires_upload}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="requires_number">Requires number</Label>
                  <input
                    id="requires_number"
                    name="requires_number"
                    type="checkbox"
                    checked={formData.requires_number}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="is_required">Required</Label>
                  <input
                    id="is_required"
                    name="is_required"
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="is_active">Active</Label>
                  <input
                    id="is_active"
                    name="is_active"
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </div>
                {formData.requires_expiry && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="default_validity_days">Default validity days</Label>
                      <Input
                        id="default_validity_days"
                        name="default_validity_days"
                        type="number"
                        value={formData.default_validity_days}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="renewal_notice_days">Renewal notice days</Label>
                      <Input
                        id="renewal_notice_days"
                        name="renewal_notice_days"
                        type="number"
                        value={formData.renewal_notice_days}
                        onChange={handleChange}
                      />
                    </div>
                  </>
                )}
                <div className="flex items-end gap-2 md:col-span-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : formMode === 'edit' ? 'Save changes' : 'Create requirement'}
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
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2 pr-4">Subject</th>
                    <th className="py-2 pr-4">Criticality</th>
                    <th className="py-2 pr-4">Expiry</th>
                    <th className="py-2 pr-4">Upload</th>
                    <th className="py-2 pr-4">Number</th>
                    <th className="py-2 pr-4">Notice</th>
                    <th className="py-2 pr-4">Active</th>
                    <th className="py-2 pr-4">Updated</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={11}>
                        No requirements found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((req) => (
                      <tr key={req.id} className="border-b last:border-b-0">
                        <td className="py-3 pr-4 font-medium text-slate-800">{req.name}</td>
                        <td className="py-3 pr-4 text-slate-600">{req.code || '—'}</td>
                        <td className="py-3 pr-4 text-slate-600">{req.subject_type}</td>
                        <td className="py-3 pr-4 text-slate-600">{req.criticality}</td>
                        <td className="py-3 pr-4 text-slate-600">{req.requires_expiry ? 'Yes' : 'No'}</td>
                        <td className="py-3 pr-4 text-slate-600">{req.requires_upload ? 'Yes' : 'No'}</td>
                        <td className="py-3 pr-4 text-slate-600">{req.requires_number ? 'Yes' : 'No'}</td>
                        <td className="py-3 pr-4 text-slate-600">{req.renewal_notice_days ?? '—'}</td>
                        <td className="py-3 pr-4 text-slate-600">{req.is_active ? 'Yes' : 'No'}</td>
                        <td className="py-3 pr-4 text-slate-600">
                          {req.updated_at ? new Date(req.updated_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" onClick={() => startEdit(req)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => startDuplicate(req)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => toggleActive(req)}>
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => deleteRequirement(req)}>
                              <Trash2 className="h-3.5 w-3.5" />
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

