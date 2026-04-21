'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'
import { Pencil, Trash2 } from 'lucide-react'

export function CallLogViewActions({ id, subject }: { id: number; subject: string | null | undefined }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error: deleteErr } = await supabase.from('call_logs').delete().eq('id', id)
      if (deleteErr) throw deleteErr

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'call_logs', record_id: id, action: 'DELETE' }),
      })

      console.debug('[CallLogViewActions] deleted call log', id)
      setOpen(false)
      router.push('/dashboard/call-logs')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete failed'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3 sm:max-w-none sm:items-end">
      {open && (
        <ConfirmDeleteCard
          entityName={subject ? `Call log: ${subject}` : `Call log #${id}`}
          items={[
            'The call log record',
            'All linked passenger, driver, and route references',
            'Subject, notes, and follow-up data',
          ]}
          confirmLabel="Yes, Delete Call Log"
          onConfirm={handleDelete}
          onCancel={() => {
            setOpen(false)
            setError(null)
          }}
          loading={loading}
          error={error}
        />
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          onClick={() => {
            console.debug('[CallLogViewActions] open delete confirm', id)
            setOpen(true)
            setError(null)
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
        <Link href={`/dashboard/call-logs/${id}/edit`}>
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>
    </div>
  )
}
