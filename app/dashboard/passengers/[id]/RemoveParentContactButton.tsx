'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { X } from 'lucide-react'

interface RemoveParentContactButtonProps {
  linkId: number
  contactName: string
}

export default function RemoveParentContactButton({ linkId, contactName }: RemoveParentContactButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to unlink ${contactName}?`)) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('passenger_parent_contacts')
        .delete()
        .eq('id', linkId)

      if (error) throw error

      router.refresh()
    } catch (error: any) {
      console.error('Error removing link:', error)
      alert('Failed to remove link: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-600 hover:text-red-800 hover:bg-red-50"
      onClick={handleRemove}
      disabled={loading}
    >
      <X className="h-4 w-4" />
    </Button>
  )
}

