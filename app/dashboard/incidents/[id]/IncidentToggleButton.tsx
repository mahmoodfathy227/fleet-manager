'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { CheckCircle, XCircle } from 'lucide-react'

interface IncidentToggleButtonProps {
  incidentId: number
  initialResolved: boolean
}

export default function IncidentToggleButton({ incidentId, initialResolved }: IncidentToggleButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [resolved, setResolved] = useState(initialResolved)

  const handleToggle = async () => {
    setLoading(true)
    const newResolvedStatus = !resolved

    try {
      const { error } = await supabase
        .from('incidents')
        .update({ resolved: newResolvedStatus })
        .eq('id', incidentId)

      if (error) throw error

      setResolved(newResolvedStatus)
      router.refresh()
    } catch (error: any) {
      console.error('Error updating incident:', error)
      alert('Failed to update incident status: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleToggle}
      disabled={loading}
      variant={resolved ? 'secondary' : 'primary'}
      className={resolved ? '' : 'bg-green-600 hover:bg-green-700'}
    >
      {resolved ? (
        <>
          <XCircle className="mr-2 h-4 w-4" />
          Mark as Open
        </>
      ) : (
        <>
          <CheckCircle className="mr-2 h-4 w-4" />
          Mark as Resolved
        </>
      )}
    </Button>
  )
}

