import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { assignment_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { assignment_id } = body
  if (!assignment_id || typeof assignment_id !== 'string') {
    return NextResponse.json({ error: 'assignment_id (UUID string) required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('vehicle_compliance_spare_assignments')
    .update({
      reverted_at: new Date().toISOString(),
      reverted_by: user.id,
    })
    .eq('id', assignment_id)
    .is('reverted_at', null)

  if (error) {
    console.error('Revert spare error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
