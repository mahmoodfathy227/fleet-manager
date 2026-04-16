'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'

const DELETE_BULLETS = [
  'The incident record',
  'All linked employees and passengers',
  'All incident notes and attachments',
  'Any TR5/TR6/TR7 form data linked to this incident',
] as const

type Placement = 'table' | 'header'

export function IncidentDeleteConfirmTrigger({
  incidentId,
  placement = 'table',
}: {
  incidentId: number
  placement?: Placement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.debug('[IncidentDeleteConfirmTrigger] dialog closed (Escape)', { incidentId })
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close, incidentId])

  const triggerClass =
    placement === 'header'
      ? cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-red-600 bg-white',
          'hover:bg-red-50 hover:text-red-700 hover:border-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2'
        )
      : cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-600',
          'hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2'
        )

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        aria-label={`Delete incident ${incidentId}`}
        title="Delete incident"
        onClick={() => {
          console.debug('[IncidentDeleteConfirmTrigger] open delete confirmation dialog', { incidentId, placement })
          setOpen(true)
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => {
            console.debug('[IncidentDeleteConfirmTrigger] dialog closed (backdrop)', { incidentId })
            close()
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-delete-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="incident-delete-dialog-title" className="sr-only">
              Confirm delete incident {incidentId}
            </h2>
            <ConfirmDeleteCard
              entityName={`Incident #${incidentId}`}
              items={[...DELETE_BULLETS]}
              confirmLabel="Continue to delete"
              onConfirm={() => {
                console.debug('[IncidentDeleteConfirmTrigger] confirmed — navigate to delete page', { incidentId })
                setOpen(false)
                router.push(`/dashboard/incidents/${incidentId}/delete`)
              }}
              onCancel={() => {
                console.debug('[IncidentDeleteConfirmTrigger] cancelled', { incidentId })
                close()
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
