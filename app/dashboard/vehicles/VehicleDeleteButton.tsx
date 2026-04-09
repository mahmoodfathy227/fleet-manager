'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/Button'
import { Trash2, Loader2 } from 'lucide-react'

type Props = {
  vehicleId: number
  /** Shown in confirm dialog (e.g. identifier or registration) */
  label: string
}

export function VehicleDeleteButton({ vehicleId, label }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { has, loading } = usePermissions()
  const canDelete = has('vehicles.write')
  const [busy, setBusy] = useState(false)

  if (loading || !canDelete) return null

  const handleDelete = async () => {
    const ok = window.confirm(
      `Delete vehicle ${label} (#${vehicleId})? This cannot be undone. If routes or other records still reference this vehicle, delete will fail.`
    )
    if (!ok) return

    setBusy(true)
    console.debug('[fleet] VehicleDeleteButton: delete vehicle', vehicleId)
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId)
      if (error) {
        console.debug('[fleet] VehicleDeleteButton: delete failed', error.message)
        window.alert(error.message || 'Could not delete vehicle. It may still be assigned to a route or linked to other records.')
        return
      }
      console.debug('[fleet] VehicleDeleteButton: delete ok', vehicleId)
      router.refresh()
    } catch (e) {
      console.error('[fleet] VehicleDeleteButton: delete error', e)
      window.alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-slate-500 hover:text-red-600 hover:bg-red-50"
      title="Delete vehicle"
      disabled={busy}
      onClick={handleDelete}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  )
}
