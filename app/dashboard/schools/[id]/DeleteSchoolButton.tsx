'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Trash2 } from 'lucide-react'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'

interface DeleteSchoolButtonProps {
  schoolId: number
  schoolName: string
  routeCount: number
  passengerCount: number
}

export default function DeleteSchoolButton({
  schoolId,
  schoolName,
  routeCount,
  passengerCount,
}: DeleteSchoolButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      // Delete the school - this will cascade delete routes, passengers, and crew
      const { error: deleteError } = await supabase
        .from('schools')
        .delete()
        .eq('id', schoolId)

      if (deleteError) throw deleteError

      // Audit log (non-blocking)
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'schools',
          record_id: schoolId,
          action: 'DELETE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      router.push('/dashboard/schools')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting the school')
      setDeleting(false)
    }
  }

  if (showConfirm) {
    return (
      <ConfirmDeleteCard
        entityName={schoolName}
        items={[
          'The school record',
          `${routeCount} route${routeCount !== 1 ? 's' : ''} and all associated data`,
          `${passengerCount} passenger${passengerCount !== 1 ? 's' : ''}`,
          'All crew assignments for this school',
          'All route points, sessions, and attendance records',
        ]}
        confirmLabel="Yes, Delete School"
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
      Delete School
    </Button>
  )
}

