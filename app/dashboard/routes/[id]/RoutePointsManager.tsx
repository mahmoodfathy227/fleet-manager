'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Pencil, Trash2, Plus } from 'lucide-react'
import Link from 'next/link'

interface RoutePoint {
  id: number
  point_name: string
  address: string
  latitude: number | null
  longitude: number | null
  stop_order: number
  passenger_id: number | null
  pickup_time_am: string | null
  pickup_time_pm: string | null
  passengers?: {
    id: number
    full_name: string
  } | null
}

interface RoutePointsManagerProps {
  routeId: number
  routePoints: RoutePoint[]
  onUpdate?: () => void
}

export default function RoutePointsManager({ routeId, routePoints, onUpdate }: RoutePointsManagerProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleDelete = async (pointId: number) => {
    if (!confirm('Are you sure you want to delete this pickup point?')) {
      return
    }

    setDeleting(pointId)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('route_points')
        .delete()
        .eq('id', pointId)

      if (error) throw error

      // Refresh the page or call onUpdate callback
      if (onUpdate) {
        onUpdate()
      } else {
        router.refresh()
      }
    } catch (error: any) {
      alert('Error deleting pickup point: ' + error.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link href={`/dashboard/routes/${routeId}/edit`}>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/10">
          <Pencil className="mr-1 h-4 w-4" />
          Manage Points
        </Button>
      </Link>
    </div>
  )
}
