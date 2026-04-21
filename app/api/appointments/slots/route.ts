import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function positiveIntId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseInt(value, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

export async function GET() {
  try {
    const supabase = await createClient()
    // Avoid embedding `employees(...)` here: PostgREST requires a registered FK from
    // appointment_slots → employees; if the DB has assigned_employee_id without that FK, GET 500s (PGRST200).
    const { data: slots, error } = await supabase
      .from('appointment_slots')
      .select(
        '*, appointment_bookings(id, notification_id, booked_by_email, booked_by_name, status, booked_at, notes)'
      )
      .order('slot_start', { ascending: true })

    if (error) throw error

    const rows = (slots || []) as Record<string, unknown>[]
    const crewIds = Array.from(
      new Set(rows.map((r) => positiveIntId(r.assigned_employee_id)).filter((id): id is number => id != null))
    )

    let crewById = new Map<number, { id: number; full_name: string | null; personal_email: string | null }>()
    if (crewIds.length > 0) {
      const { data: crewRows, error: crewErr } = await supabase
        .from('employees')
        .select('id, full_name, personal_email')
        .in('id', crewIds)
      if (crewErr) throw crewErr
      crewById = new Map(
        (crewRows || []).map((e) => [e.id as number, e as { id: number; full_name: string | null; personal_email: string | null }])
      )
      console.debug('[fleet] GET /api/appointments/slots: loaded intended crew rows', crewRows?.length ?? 0, 'for', crewIds.length, 'slot ref(s)')
    }

    const normalized = rows.map((row) => {
      const id = positiveIntId(row.assigned_employee_id)
      const intended_crew = id != null ? crewById.get(id) ?? null : null
      return {
        ...row,
        intended_crew,
      }
    })

    return NextResponse.json({ slots: normalized })
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
    const { slotStart, slotEnd, notes, plannedBookingContext, assignedEmployeeId } = body

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

    const parsedAssigned =
      assignedEmployeeId != null && assignedEmployeeId !== ''
        ? parseInt(String(assignedEmployeeId), 10)
        : NaN
    const assignedEmployeeIdClean =
      Number.isFinite(parsedAssigned) && parsedAssigned > 0 ? parsedAssigned : null

    const insertBase = {
      slot_start: slotStart,
      slot_end: slotEnd,
      notes: notes || null,
      created_by: userRow?.id || null,
    }
    const insertWithOptional = {
      ...insertBase,
      planned_booking_context:
        typeof plannedBookingContext === 'string' && plannedBookingContext.trim()
          ? plannedBookingContext.trim()
          : null,
      assigned_employee_id: assignedEmployeeIdClean,
    }

    let data: Record<string, any> | null = null
    let error: any = null

    ;({ data, error } = await supabase
      .from('appointment_slots')
      .insert(insertWithOptional)
      .select()
      .single())

    const message = String(error?.message || '')
    const missingOptionalColumn =
      error?.code === 'PGRST204' &&
      (message.includes("'assigned_employee_id'") || message.includes("'planned_booking_context'"))

    if (missingOptionalColumn) {
      console.debug(
        '[fleet] POST /api/appointments/slots: schema cache missing optional slot columns; retrying with base payload'
      )
      ;({ data, error } = await supabase
        .from('appointment_slots')
        .insert(insertBase)
        .select()
        .single())
    }

    if (error) throw error

    console.debug(
      '[fleet] POST /api/appointments/slots: created with planned context / intended crew',
      !!data?.planned_booking_context,
      !!data?.assigned_employee_id
    )

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

