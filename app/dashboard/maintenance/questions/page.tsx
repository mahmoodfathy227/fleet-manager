'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'
import { formatDateTime } from '@/lib/utils'
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  ClipboardList,
  Loader2,
  Search,
} from 'lucide-react'

export type MaintenanceSeverity = 'low' | 'medium' | 'high'

export interface MaintenanceQuestionRow {
  id: string
  question_title: string
  question_desc: string | null
  image_bool: boolean
  video_bool: boolean
  category: string
  severity: MaintenanceSeverity
  updated_at: string
}

const SEVERITY_OPTIONS: MaintenanceSeverity[] = ['low', 'medium', 'high']

export default function MaintenanceQuestionsListPage() {
  const router = useRouter()
  const supabase = createClient()
  const { has, loading: permLoading } = usePermissions()
  const [rows, setRows] = useState<MaintenanceQuestionRow[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canView = has('maintenance_questions.view')
  const canCreate = has('maintenance_questions.create')
  const canUpdate = has('maintenance_questions.update')
  const canDelete = has('maintenance_questions.delete')

  useEffect(() => {
    if (!permLoading && !canView) {
      router.replace('/dashboard')
      return
    }
  }, [permLoading, canView, router])

  useEffect(() => {
    if (!canView) return
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('maintenance_checks_question')
        .select('id, question_title, question_desc, image_bool, video_bool, category, severity, updated_at')
        .order('updated_at', { ascending: false })
      if (error) {
        setRows([])
        setLoading(false)
        return
      }
      const list = (data ?? []) as MaintenanceQuestionRow[]
      setRows(list)
      const cats = Array.from(new Set(list.map((r) => r.category).filter(Boolean))).sort()
      setCategories(cats)
      setLoading(false)
    }
    load()
  }, [canView, supabase])

  const filtered = rows.filter((r) => {
    const searchLower = search.trim().toLowerCase()
    if (searchLower) {
      const matchTitle = r.question_title?.toLowerCase().includes(searchLower)
      const matchDesc = r.question_desc?.toLowerCase().includes(searchLower)
      if (!matchTitle && !matchDesc) return false
    }
    if (filterCategory && r.category !== filterCategory) return false
    if (filterSeverity && r.severity !== filterSeverity) return false
    return true
  })

  const handleDeleteConfirm = async () => {
    if (!deleteId || !canDelete) return
    setDeleteLoading(true)
    setDeleteError(null)
    const { error } = await supabase.from('maintenance_checks_question').delete().eq('id', deleteId)
    setDeleteLoading(false)
    if (error) {
      setDeleteError(error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== deleteId))
    setDeleteId(null)
    setSuccessMessage('Question deleted.')
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  if (!permLoading && !canView) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Maintenance Questions</h1>
            <p className="text-sm text-slate-500">Manage maintenance check questions</p>
          </div>
        </div>
        {canCreate && (
          <Link href="/dashboard/maintenance/questions/new">
            <Button className="bg-primary hover:bg-primary/90 text-white">
              <Plus className="mr-2 h-4 w-4" />
              New Question
            </Button>
          </Link>
        )}
      </div>

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Image?</TableHead>
              <TableHead>Video?</TableHead>
              <TableHead>Updated At</TableHead>
              {(canUpdate || canDelete) && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  No questions found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-800">{r.question_title}</TableCell>
                  <TableCell className="text-slate-600">{r.category}</TableCell>
                  <TableCell className="text-slate-600 capitalize">{r.severity}</TableCell>
                  <TableCell>{r.image_bool ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{r.video_bool ? 'Yes' : 'No'}</TableCell>
                  <TableCell className="text-slate-500">{formatDateTime(r.updated_at)}</TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/maintenance/questions/${r.id}`}>
                          <Button variant="ghost" size="sm" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {canUpdate && (
                          <Link href={`/dashboard/maintenance/questions/${r.id}/edit`}>
                            <Button variant="ghost" size="sm" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteId(r.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {deleteId && (
        <Modal
          isOpen={!!deleteId}
          onClose={() => !deleteLoading && setDeleteId(null)}
          title="Delete question"
        >
          <ConfirmDeleteCard
            entityName="this question"
            items={['The selected maintenance question']}
            confirmLabel="Yes, delete"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteId(null)}
            loading={deleteLoading}
            error={deleteError}
          />
        </Modal>
      )}
    </div>
  )
}
