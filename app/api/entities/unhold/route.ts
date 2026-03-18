import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { userId: null, user: null }

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  return { userId: userRow?.id ?? null, user }
}

export async function POST(request: Request) {
  try {
    const { entityType, entityId } = await request.json()

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { userId, user } = await getUserId(supabase)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clearPayload = {
      on_hold: false,
      on_hold_reason: null,
      on_hold_notification_id: null,
      on_hold_set_by: userId,
      on_hold_set_at: null,
      on_hold_cleared_at: new Date().toISOString(),
    }

    // Clear holds (serial to avoid type issues with builder)
    if (entityType === 'vehicle') {
      await supabase.from('vehicles').update(clearPayload).eq('id', entityId)
      await supabase.from('routes').update(clearPayload).eq('vehicle_id', entityId)
    } else if (entityType === 'driver') {
      await supabase.from('drivers').update(clearPayload).eq('employee_id', entityId)
      await supabase.from('routes').update(clearPayload).eq('driver_id', entityId)
      const { data: routeVehicles } = await supabase
        .from('routes')
        .select('vehicle_id')
        .eq('driver_id', entityId)
        .not('vehicle_id', 'is', null)
      const vehicleIds =
        routeVehicles?.map((r: any) => r.vehicle_id).filter(Boolean) || []
      if (vehicleIds.length > 0) {
        await supabase.from('vehicles').update(clearPayload).in('id', vehicleIds)
      }
    } else if (entityType === 'assistant') {
      await supabase
        .from('passenger_assistants')
        .update(clearPayload)
        .eq('employee_id', entityId)
      await supabase
        .from('routes')
        .update(clearPayload)
        .eq('passenger_assistant_id', entityId)
      const { data: routeVehicles } = await supabase
        .from('routes')
        .select('vehicle_id')
        .eq('passenger_assistant_id', entityId)
        .not('vehicle_id', 'is', null)
      const vehicleIds =
        routeVehicles?.map((r: any) => r.vehicle_id).filter(Boolean) || []
      if (vehicleIds.length > 0) {
        await supabase.from('vehicles').update(clearPayload).in('id', vehicleIds)
      }
    }

    // Audit (best-effort)
    const tableMap: Record<string, string> = {
      vehicle: 'vehicles',
      driver: 'drivers',
      assistant: 'passenger_assistants',
    }
    const tableName = tableMap[entityType]
    if (tableName) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: tableName,
          record_id: parseInt(entityId, 10),
          action: 'UPDATE',
        }),
      }).catch((err) => console.error('Audit log error (unhold):', err))
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error clearing hold:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to clear hold' },
      { status: 500 }
    )
  }
}

