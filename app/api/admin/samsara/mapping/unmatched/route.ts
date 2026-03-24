import { NextRequest, NextResponse } from 'next/server'
import { hasAnyServerPermission } from '@/lib/auth/server-permissions'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const isAllowed = await hasAnyServerPermission([
      'users.manage',
      'roles.assign',
      'integrations.samsara.manage',
    ])

    if (!isAllowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'open'
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500)

    const supabase = createServiceClient()
    let query = supabase
      .from('samsara_vehicle_unmatched')
      .select('*')
      .order('last_seen_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ unmatched: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load unmatched mappings' },
      { status: 500 }
    )
  }
}
