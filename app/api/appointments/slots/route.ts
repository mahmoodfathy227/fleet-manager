import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: slots, error } = await supabase
      .from('appointment_slots')
      .select('*, appointment_bookings(id, notification_id, booked_by_email, booked_by_name, status, booked_at, notes)')
      .order('slot_start', { ascending: true })

    if (error) throw error
    return NextResponse.json({ slots: slots || [] })
  } catch (error: any) {
    console.error('Error fetching appointment slots:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch appointment slots' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { slotStart, slotEnd, notes } = body

    if (!slotStart || !slotEnd) {
      return NextResponse.json({ error: 'slotStart and slotEnd are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    const { data, error } = await supabase
      .from('appointment_slots')
      .insert({
        slot_start: slotStart,
        slot_end: slotEnd,
        notes: notes || null,
        created_by: userRow?.id || null,
      })
      .select()
      .single()

    if (error) throw error

    // Audit (best-effort)
    if (data?.id) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'appointment_slots',
          record_id: data.id,
          action: 'CREATE',
        }),
      }).catch((err) => console.error('Audit log error (appointment slot):', err))
    }

    return NextResponse.json({ success: true, slot: data })
  } catch (error: any) {
    console.error('Error creating appointment slot:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create appointment slot' },
      { status: 500 }
    )
  }
}

