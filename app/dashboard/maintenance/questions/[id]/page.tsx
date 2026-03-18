'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft, Pencil, Loader2 } from 'lucide-react'

interface QuestionDetail {
  id: string
  question_title: string
  question_desc: string | null
  image_bool: boolean
  video_bool: boolean
  category: string
  icon: string | null
  color: string | null
  severity: string
  icon_path: string | null
  created_at: string
  updated_at: string
}

export default function MaintenanceQuestionViewPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const { has, loading: permLoading } = usePermissions()
  const [row, setRow] = useState<QuestionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const id = params?.id as string
  const canView = has('maintenance_questions.view')
  const canUpdate = has('maintenance_questions.update')

  useEffect(() => {
    if (!permLoading && !canView) {
      router.replace('/dashboard')
      return
    }
  }, [permLoading, canView, router])

  useEffect(() => {
    if (!canView || !id) return
    const load = async () => {
      const { data, error } = await supabase
        .from('maintenance_checks_question')
        .select('*')
        .eq('id', id)
        .single()
      if (error || !data) {
        setRow(null)
        setLoading(false)
        return
      }
      setRow(data as QuestionDetail)
      setLoading(false)
    }
    load()
  }, [canView, id, supabase])

  if (!permLoading && !canView) return null
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }
  if (!row) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/maintenance/questions"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>
        <p className="text-slate-600">Question not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/maintenance/questions"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>
        {canUpdate && (
          <Link href={`/dashboard/maintenance/questions/${id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{row.question_title}</CardTitle>
          <p className="text-sm text-slate-500">
            Updated {formatDateTime(row.updated_at)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {row.question_desc && (
            <div>
              <p className="text-sm font-medium text-slate-600">Description</p>
              <p className="text-slate-700 whitespace-pre-wrap">{row.question_desc}</p>
            </div>
          )}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Category</dt>
              <dd className="font-medium text-slate-800">{row.category}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Severity</dt>
              <dd className="font-medium text-slate-800 capitalize">{row.severity}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Image</dt>
              <dd className="font-medium text-slate-800">{row.image_bool ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Video</dt>
              <dd className="font-medium text-slate-800">{row.video_bool ? 'Yes' : 'No'}</dd>
            </div>
            {row.icon && (
              <div>
                <dt className="text-slate-500">Icon</dt>
                <dd className="font-medium text-slate-800">{row.icon}</dd>
              </div>
            )}
            {row.icon_path && (
              <div className="sm:col-span-2">
                <dt className="text-slate-500 mb-1">Icon</dt>
                <dd className="flex items-center gap-3">
                  <img
                    src={supabase.storage.from('MAINTENANCE_ICONS').getPublicUrl(row.icon_path).data.publicUrl}
                    alt="Question icon"
                    className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                  />
                  <span className="text-xs text-slate-500 truncate max-w-[200px]" title={row.icon_path}>
                    {row.icon_path}
                  </span>
                </dd>
              </div>
            )}
            {row.color && (
              <div>
                <dt className="text-slate-500">Color</dt>
                <dd className="flex items-center gap-2">
                  <span
                    className="inline-block w-5 h-5 rounded border border-slate-200"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="font-medium text-slate-800">{row.color}</span>
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
