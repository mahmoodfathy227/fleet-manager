import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sliceIsoDate } from '@/lib/routesCalendar'

export const dynamic = 'force-dynamic'

function daysUntilFromToday(expiryDate: string): number {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const e = new Date(expiryDate + 'T12:00:00')
  return Math.round((e.getTime() - t.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * POST — create a compliance notification (certificate_expiry) for coordinator follow-up / email flow.
 * Body: { employeeId, certKey, certLabel, expiryDate, role: 'driver' | 'pa' }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    employeeId: number
    certKey: string
    certLabel: string
    expiryDate: string
    role: 'driver' | 'pa'
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { employeeId, certKey, certLabel, expiryDate, role } = body
  if (!employeeId || !certKey || !certLabel || !expiryDate || (role !== 'driver' && role !== 'pa')) {
    return NextResponse.json({ error: 'employeeId, certKey, certLabel, expiryDate, role required' }, { status: 400 })
  }

  const exp = sliceIsoDate(expiryDate) ?? expiryDate.slice(0, 10)
  const days = daysUntilFromToday(exp)

  try {
    const { data: emp, error: empErr } = await supabase
      .from('employees')
      .select('id, personal_email, full_name')
      .eq('id', employeeId)
      .maybeSingle()

    if (empErr) throw empErr
    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const entity_type = role === 'driver' ? 'driver' : 'assistant'

    const { data: inserted, error: insErr } = await supabase
      .from('notifications')
      .insert({
        notification_type: 'certificate_expiry',
        entity_type,
        entity_id: employeeId,
        certificate_type: certKey,
        certificate_name: certLabel,
        expiry_date: exp,
        days_until_expiry: days,
        recipient_employee_id: employeeId,
        recipient_email: emp.personal_email ?? null,
        status: 'pending',
        admin_response_required: true,
        details: {
          source: 'operations_calendar',
          created_via: 'coordinator_warning',
        },
      })
      .select('id')
      .single()

    if (insErr) throw insErr

    console.debug('[fleet] routes-calendar/warning: notification created', inserted?.id, employeeId, certKey)

    return NextResponse.json({ success: true, notificationId: inserted?.id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create notification'
    console.error('[fleet] routes-calendar/warning', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
