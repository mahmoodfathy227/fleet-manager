'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Trash2 } from 'lucide-react'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'

interface DeletePAButtonProps {
  paId: number
  employeeId: number
  paName: string
}

export default function DeletePAButton({
  paId,
  employeeId,
  paName,
}: DeletePAButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      // Delete route_passenger_assistants entries (cascade via employee_id)
      const { error: routePaError } = await supabase
        .from('route_passenger_assistants')
        .delete()
        .eq('employee_id', employeeId)

      if (routePaError) {
        console.warn('Error deleting route_passenger_assistants:', routePaError)
        // Continue anyway - might not have any routes assigned
      }

      // Set routes.passenger_assistant_id to NULL where it matches this PA
      const { error: routesError } = await supabase
        .from('routes')
        .update({ passenger_assistant_id: null })
        .eq('passenger_assistant_id', employeeId)

      if (routesError) {
        console.warn('Error updating routes:', routesError)
        // Continue anyway
      }

      // Delete the PA record - this will cascade delete:
      // - subject_documents (via pa_employee_id)
      // - document_pa_links (via pa_employee_id)
      // - certificates (via pa_employee_id)
      const { error: deleteError } = await supabase
        .from('passenger_assistants')
        .delete()
        .eq('id', paId)

      if (deleteError) throw deleteError

      // Audit log (non-blocking)
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'passenger_assistants',
          record_id: paId,
          action: 'DELETE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      router.push('/dashboard/assistants')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting the passenger assistant')
      setDeleting(false)
    }
  }

  if (showConfirm) {
    return (
      <ConfirmDeleteCard
        entityName={paName}
        items={[
          'The passenger assistant record',
          'All subject documents and certificates',
          'All document links',
          'All route assignments',
        ]}
        confirmLabel="Yes, Delete PA"
        onConfirm={handleDelete}
        onCancel={() => {
          setShowConfirm(false)
          setError(null)
        }}
        loading={deleting}
        error={error}
      />
    )
  }

  return (
    <Button
      variant="danger"
      onClick={() => setShowConfirm(true)}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Delete PA
    </Button>
  )
}
