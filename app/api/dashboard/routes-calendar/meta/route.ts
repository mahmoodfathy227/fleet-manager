import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Schools + routes for operations calendar filters */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [{ data: schools, error: sErr }, { data: routes, error: rErr }] = await Promise.all([
      supabase.from('schools').select('id, name').order('name'),
      supabase
        .from('routes')
        .select('id, route_number, school_id, schools(id, name)')
        .order('school_id', { ascending: true })
        .order('route_number', { ascending: true }),
    ])

    if (sErr) throw sErr
    if (rErr) throw rErr

    console.debug('[fleet] routes-calendar/meta: schools', schools?.length, 'routes', routes?.length)

    return NextResponse.json({
      schools: schools ?? [],
      routes: routes ?? [],
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load meta'
    console.error('[fleet] routes-calendar/meta', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
