import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_EVENT_TYPES = ['arrived', 'picked_up', 'dropped_off', 'skipped', 'no_show'] as const
type EventType = typeof VALID_EVENT_TYPES[number]

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessionId = Number(params.id)
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const eventType = String(body.event_type ?? '') as EventType
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json(
      { error: `event_type must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const routePointId  = body.route_point_id  != null ? Number(body.route_point_id)  : null
  const passengerId   = body.passenger_id    != null ? Number(body.passenger_id)    : null
  const notes         = typeof body.notes === 'string' ? body.notes.trim() || null : null

  if (routePointId !== null && !Number.isFinite(routePointId)) {
    return NextResponse.json({ error: 'Invalid route_point_id' }, { status: 400 })
  }
  if (passengerId !== null && !Number.isFinite(passengerId)) {
    return NextResponse.json({ error: 'Invalid passenger_id' }, { status: 400 })
  }

  // Verify the requesting user is the driver or PA for this session
  // route_sessions.driver_id / passenger_assistant_id are employee INT IDs —
  // we resolve via employees.user_id = auth.uid()
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!employee) {
    return NextResponse.json({ error: 'Not an employee account' }, { status: 403 })
  }

  const { data: session } = await supabase
    .from('route_sessions')
    .select('id, ended_at, driver_id, passenger_assistant_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.ended_at) {
    return NextResponse.json({ error: 'Session has already ended' }, { status: 409 })
  }

  const isAssigned =
    session.driver_id === employee.id ||
    session.passenger_assistant_id === employee.id

  if (!isAssigned) {
    return NextResponse.json({ error: 'You are not assigned to this session' }, { status: 403 })
  }

  const { data: event, error: insertError } = await supabase
    .from('route_stop_events')
    .insert({
      route_session_id: sessionId,
      route_point_id:   routePointId,
      passenger_id:     passengerId,
      event_type:       eventType,
      recorded_by:      user.id,
      notes,
    })
    .select('id, event_type, event_at')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(event, { status: 201 })
}
