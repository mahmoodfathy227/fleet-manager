'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { IconPathUpload } from '@/components/maintenance/IconPathUpload'
import type { MaintenanceSeverity } from '../page'

const SEVERITY_OPTIONS: MaintenanceSeverity[] = ['low', 'medium', 'high']

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function validateColor(value: string): boolean {
  if (!value.trim()) return true
  return HEX_REGEX.test(value.trim())
}

function toColorPickerValue(hex: string, fallback = '#808080'): string {
  const v = hex.trim()
  if (!v) return fallback
  const m = v.match(/^#([0-9a-fA-F]{3})$/)
  if (m) return '#' + m[1].split('').map((c) => c + c).join('')
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback
}

export default function NewMaintenanceQuestionPage() {
  const router = useRouter()
  const supabase = createClient()
  const { has, loading: permLoading } = usePermissions()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    question_title: '',
    question_desc: '',
    category: '',
    severity: 'medium' as MaintenanceSeverity,
    image_bool: false,
    video_bool: false,
    icon: '',
    icon_path: '',
    color: '',
  })

  const canCreate = has('maintenance_questions.create')
  const titleValid = form.question_title.trim() !== ''
  const categoryValid = form.category.trim() !== ''
  const colorValid = validateColor(form.color)
  const isValid = titleValid && categoryValid && colorValid

  if (!permLoading && !canCreate) {
    router.replace('/dashboard/maintenance/questions')
    return
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || saving) return
    setError(null)
    setSaving(true)
    const { error: err } = await supabase.from('maintenance_checks_question').insert({
      question_title: form.question_title.trim(),
      question_desc: form.question_desc.trim() || null,
      category: form.category.trim(),
      severity: form.severity,
      image_bool: form.image_bool,
      video_bool: form.video_bool,
      icon: form.icon.trim() || null,
      icon_path: form.icon_path.trim() || null,
      color: form.color.trim() || null,
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setSuccessMessage('Question created.')
    setTimeout(() => {
      router.push('/dashboard/maintenance/questions')
    }, 800)
  }

  if (!permLoading && !canCreate) return null

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/maintenance/questions"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to list
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">New maintenance question</h1>

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Question details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="question_title">Title *</Label>
              <Input
                id="question_title"
                value={form.question_title}
                onChange={(e) => setForm((f) => ({ ...f, question_title: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="question_desc">Description</Label>
              <textarea
                id="question_desc"
                value={form.question_desc}
                onChange={(e) => setForm((f) => ({ ...f, question_desc: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="severity">Severity</Label>
              <select
                id="severity"
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as MaintenanceSeverity }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.image_bool}
                  onChange={(e) => setForm((f) => ({ ...f, image_bool: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Image</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.video_bool}
                  onChange={(e) => setForm((f) => ({ ...f, video_bool: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">Video</span>
              </label>
            </div>
            <div>
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              />
            </div>
            <div>
              <IconPathUpload
                value={form.icon_path}
                onChange={(path) => setForm((f) => ({ ...f, icon_path: path }))}
                disabled={saving}
              />
            </div>
            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color"
                  value={toColorPickerValue(form.color)}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#fff or #ffffff"
                  className="flex-1 max-w-[140px] font-mono text-sm"
                />
              </div>
              {form.color && !colorValid && (
                <p className="text-xs text-red-600 mt-1">Must be #xxx or #xxxxxx</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!isValid || saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Link href="/dashboard/maintenance/questions">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
