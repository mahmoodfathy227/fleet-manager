import { NextResponse } from 'next/server'
import { hasAnyServerPermission } from '@/lib/auth/server-permissions'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const isAllowed = await hasAnyServerPermission([
      'users.manage',
      'roles.assign',
      'integrations.samsara.manage',
    ])

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const vehicleId = Number(body.vehicleId)
    const samsaraVehicleId = String(body.samsaraVehicleId || '')
    const unmatchedId = body.unmatchedId ? Number(body.unmatchedId) : null
    const note = body.note ? String(body.note) : null

    if (!Number.isFinite(vehicleId) || !samsaraVehicleId) {
      return NextResponse.json(
        { error: 'vehicleId and samsaraVehicleId are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const sessionClient = await createClient()
    const {
      data: { user: authUser },
    } = await sessionClient.auth.getUser()

    let changedBy: number | null = null
    if (authUser?.email) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()
      changedBy = userRow?.id || null
    }

    const { data: currentVehicle, error: currentVehicleError } = await supabase
      .from('vehicles')
      .select('id, samsara_vehicle_id')
      .eq('id', vehicleId)
      .maybeSingle()

    if (currentVehicleError || !currentVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('vehicles')
      .update({
        samsara_vehicle_id: samsaraVehicleId,
        samsara_last_mapping_sync_at: new Date().toISOString(),
      })
      .eq('id', vehicleId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabase.from('samsara_mapping_audit_log').insert({
      vehicle_id: vehicleId,
      old_samsara_vehicle_id: currentVehicle.samsara_vehicle_id || null,
      new_samsara_vehicle_id: samsaraVehicleId,
      action: 'manual_resolve',
      reason: note || 'Manual admin mapping resolve',
      changed_by: changedBy,
      metadata: {
        unmatched_id: unmatchedId,
      },
    })

    if (Number.isFinite(unmatchedId)) {
      await supabase
        .from('samsara_vehicle_unmatched')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: changedBy,
          resolution_note: note,
        })
        .eq('id', unmatchedId)
    } else {
      await supabase
        .from('samsara_vehicle_unmatched')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: changedBy,
          resolution_note: note,
        })
        .eq('external_vehicle_id', samsaraVehicleId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve mapping' },
      { status: 500 }
    )
  }
}
