import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/** POST { note_date: "YYYY-MM-DD" } — mark that day as seen for the current user (hides unread dot) */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const note_date = body?.note_date || request.nextUrl.searchParams.get('note_date')
    if (!note_date) {
      return NextResponse.json({ error: 'note_date required' }, { status: 400 })
    }

    let userId: number | null = null
    const byAuthId = await supabase.from('users').select('id').eq('user_id', user.id).maybeSingle()
    if (byAuthId.data?.id) userId = byAuthId.data.id
    if (userId == null && user.email) {
      const byEmail = await supabase.from('users').select('id').ilike('email', user.email).maybeSingle()
      if (byEmail.data?.id) userId = byEmail.data.id
    }
    if (!userId) {
      return NextResponse.json({ error: 'User record not found' }, { status: 400 })
    }

    await supabase
      .from('calendar_day_note_views')
      .upsert({ user_id: userId, note_date }, { onConflict: 'user_id,note_date' })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Calendar notes seen POST:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to mark as seen' },
      { status: 500 }
    )
  }
}
