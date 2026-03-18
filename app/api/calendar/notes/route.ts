import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getMonthRange } from '@/lib/calendarNotes'

/** GET ?month=YYYY-MM — notes for that month + seen dates for current user */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const monthParam = request.nextUrl.searchParams.get('month')
    if (!monthParam) {
      return NextResponse.json({ error: 'month (YYYY-MM) required' }, { status: 400 })
    }
    const [y, m] = monthParam.split('-').map(Number)
    if (!y || !m || m < 1 || m > 12) {
      return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
    }
    const { start, end } = getMonthRange(y, m)

    const { data: notes, error: notesError } = await supabase
      .from('calendar_day_notes')
      .select('id, note_date, note_text, created_by, updated_by, created_at, updated_at')
      .gte('note_date', start)
      .lte('note_date', end)
      .order('note_date', { ascending: true })
      .order('created_at', { ascending: false })

    if (notesError) throw notesError

    const userIds = Array.from(new Set((notes || []).flatMap((n: any) => [n.created_by, n.updated_by].filter(Boolean))))
    let nameMap: Record<number, string> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, employee_id')
        .in('id', userIds)
      const employeeIds = Array.from(
        new Set((users || []).map((u: any) => u.employee_id).filter(Boolean))
      )
      const { data: employees } = employeeIds.length > 0
        ? await supabase.from('employees').select('id, full_name').in('id', employeeIds)
        : { data: [] as any[] }
      const employeeNameMap = (employees || []).reduce((acc: Record<number, string>, e: any) => {
        if (e.id != null && e.full_name) acc[e.id] = e.full_name
        return acc
      }, {})
      nameMap = (users || []).reduce((acc: Record<number, string>, u: any) => {
        const name = u.employee_id ? employeeNameMap[u.employee_id] : null
        if (u.id != null && name) acc[u.id] = name
        return acc
      }, {})
    }

    let userId: number | null = null
    const byAuthId = await supabase.from('users').select('id').eq('user_id', user.id).maybeSingle()
    if (byAuthId.data?.id) userId = byAuthId.data.id
    if (userId == null && user.email) {
      const byEmail = await supabase.from('users').select('id').ilike('email', user.email).maybeSingle()
      if (byEmail.data?.id) userId = byEmail.data.id
    }
    let seenDates: string[] = []
    if (userId) {
      const { data: views } = await supabase
        .from('calendar_day_note_views')
        .select('note_date')
        .eq('user_id', userId)
        .gte('note_date', start)
        .lte('note_date', end)
      seenDates = (views || []).map((v) => v.note_date)
    }

    const notesWithNames = (notes || []).map((n: any) => ({
      id: n.id,
      note_date: n.note_date,
      note_text: n.note_text,
      created_by: n.created_by,
      updated_by: n.updated_by,
      created_at: n.created_at,
      updated_at: n.updated_at,
      created_by_name: n.created_by ? nameMap[n.created_by] ?? null : null,
      updated_by_name: n.updated_by ? nameMap[n.updated_by] ?? null : null,
    }))

    return NextResponse.json({
      notes: notesWithNames,
      seen_dates: seenDates,
    })
  } catch (error: any) {
    console.error('Calendar notes GET:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}

/** POST { note_date: "YYYY-MM-DD", note_text: "..." } — insert new update (multiple per day allowed) */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { note_date, note_text } = body
    if (!note_date || typeof note_text !== 'string') {
      return NextResponse.json({ error: 'note_date and note_text required' }, { status: 400 })
    }

    let userId: number | null = null
    const byAuthId = await supabase.from('users').select('id').eq('user_id', user.id).maybeSingle()
    if (byAuthId.data?.id) userId = byAuthId.data.id
    if (userId == null && user.email) {
      const byEmail = await supabase.from('users').select('id').ilike('email', user.email).maybeSingle()
      if (byEmail.data?.id) userId = byEmail.data.id
    }

    const { data, error } = await supabase
      .from('calendar_day_notes')
      .insert({
        note_date,
        note_text: note_text.trim(),
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ note: data })
  } catch (error: any) {
    console.error('Calendar notes POST:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save note' },
      { status: 500 }
    )
  }
}

/** PATCH { id, note_text } — update a single note by id */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, note_text } = body
    if (id == null || typeof note_text !== 'string') {
      return NextResponse.json({ error: 'id and note_text required' }, { status: 400 })
    }

    let userId: number | null = null
    const byAuthId = await supabase.from('users').select('id').eq('user_id', user.id).maybeSingle()
    if (byAuthId.data?.id) userId = byAuthId.data.id
    if (userId == null && user.email) {
      const byEmail = await supabase.from('users').select('id').ilike('email', user.email).maybeSingle()
      if (byEmail.data?.id) userId = byEmail.data.id
    }

    const { data, error } = await supabase
      .from('calendar_day_notes')
      .update({
        note_text: note_text.trim(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ note: data })
  } catch (error: any) {
    console.error('Calendar notes PATCH:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update note' },
      { status: 500 }
    )
  }
}

/** DELETE ?note_date=YYYY-MM-DD (all for day) or ?id=123 (single note) */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idParam = request.nextUrl.searchParams.get('id')
    const noteDate = request.nextUrl.searchParams.get('note_date')

    if (idParam) {
      const id = Number(idParam)
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: 'id must be an integer' }, { status: 400 })
      }
      const { error } = await supabase.from('calendar_day_notes').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (noteDate) {
      const { error } = await supabase
        .from('calendar_day_notes')
        .delete()
        .eq('note_date', noteDate)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'id or note_date required' }, { status: 400 })
  } catch (error: any) {
    console.error('Calendar notes DELETE:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete note' },
      { status: 500 }
    )
  }
}
