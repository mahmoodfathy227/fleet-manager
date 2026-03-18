import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { vehicle_id: number; spare_vehicle_id: number; document_id?: number; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { vehicle_id, spare_vehicle_id, document_id, reason } = body
  if (!vehicle_id || !spare_vehicle_id || typeof vehicle_id !== 'number' || typeof spare_vehicle_id !== 'number') {
    return NextResponse.json({ error: 'vehicle_id and spare_vehicle_id (numbers) required' }, { status: 400 })
  }

  if (vehicle_id === spare_vehicle_id) {
    return NextResponse.json({ error: 'Spare vehicle must be different from affected vehicle' }, { status: 400 })
  }

  const { data: row, error } = await supabase
    .from('vehicle_compliance_spare_assignments')
    .insert({
      vehicle_id,
      spare_vehicle_id,
      document_id: document_id ?? null,
      reason: reason ?? null,
      assigned_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Assign spare error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: row?.id })
}
