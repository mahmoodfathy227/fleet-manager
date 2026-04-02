import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // --- 1. Auth: verify Bearer token ---
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Not authenticated' }, 401)
  }
  const token = authHeader.replace('Bearer ', '')

  const { data: { user }, error: authError } = await serviceClient.auth.getUser(token)
  if (authError || !user) {
    return json({ error: 'Not authenticated' }, 401)
  }

  // --- 2. Parse & validate body ---
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { passenger_id, session_type, trip_date, reason } = body

  if (
    typeof passenger_id !== 'number' ||
    (session_type !== 'AM' && session_type !== 'PM') ||
    typeof trip_date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(trip_date as string)
  ) {
    return json(
      { error: 'Missing or invalid fields. Required: passenger_id (number), session_type ("AM"|"PM"), trip_date ("YYYY-MM-DD")' },
      400
    )
  }

  const reasonText = typeof reason === 'string' && reason.trim().length > 0
    ? reason.trim()
    : null

  // --- 3. Look up parent_contacts for this auth user ---
  const { data: parentContact, error: parentError } = await serviceClient
    .from('parent_contacts')
    .select('id, full_name, email')
    .eq('user_id', user.id)
    .single()

  if (parentError || !parentContact) {
    return json({ error: 'Not a registered parent' }, 401)
  }

  // --- 4. Ownership check: is this passenger linked to this parent? ---
  const { data: link, error: linkError } = await serviceClient
    .from('passenger_parent_contacts')
    .select('id')
    .eq('passenger_id', passenger_id)
    .eq('parent_contact_id', parentContact.id)
    .single()

  if (linkError || !link) {
    return json({ error: 'Not your child' }, 403)
  }

  // --- 5. Get passenger + route details ---
  const { data: passenger, error: passengerError } = await serviceClient
    .from('passengers')
    .select(`
      full_name,
      route_id,
      routes (
        route_number,
        am_start_time,
        pm_start_time,
        pm_start_time_friday
      )
    `)
    .eq('id', passenger_id)
    .single()

  if (passengerError || !passenger) {
    return json({ error: 'Passenger not found' }, 404)
  }

  const route = (passenger as any).routes
  if (!passenger.route_id || !route) {
    return json({ error: 'Passenger has no assigned route' }, 422)
  }

  // --- 6. Time gate: check if cancellation window has passed ---
  let scheduledTime: string | null
  if (session_type === 'AM') {
    scheduledTime = route.am_start_time
  } else {
    // Use Friday PM time if trip_date falls on a Friday
    const dayOfWeek = new Date((trip_date as string) + 'T12:00:00').getDay() // 5 = Friday
    scheduledTime = (dayOfWeek === 5 && route.pm_start_time_friday)
      ? route.pm_start_time_friday
      : route.pm_start_time
  }

  if (!scheduledTime) {
    return json({ error: `No ${session_type} departure time configured for this route` }, 422)
  }

  const cutoff = new Date(`${trip_date}T${scheduledTime}`)
  if (isNaN(cutoff.getTime())) {
    return json({ error: 'Could not determine trip departure time' }, 422)
  }

  if (Date.now() >= cutoff.getTime()) {
    const hhmm = (scheduledTime as string).substring(0, 5)
    return json({ error: `Cancellation window has passed. Trip starts at ${hhmm}` }, 422)
  }

  // --- 7. Look up existing route_session (may not exist yet if driver hasn't started) ---
  const { data: session } = await serviceClient
    .from('route_sessions')
    .select('id, started_at')
    .eq('route_id', passenger.route_id)
    .eq('session_date', trip_date)
    .eq('session_type', session_type)
    .maybeSingle()

  if (session?.started_at) {
    return json({ error: 'Trip already in progress' }, 422)
  }

  const tripId: number | null = session?.id ?? null

  // --- 8. Duplicate check ---
  const duplicateQuery = serviceClient
    .from('parent_absence_reports')
    .select('id')
    .eq('passenger_id', passenger_id)

  const { data: duplicate } = tripId !== null
    ? await duplicateQuery.eq('route_session_id', tripId).maybeSingle()
    : await duplicateQuery.is('route_session_id', null).maybeSingle()

  if (duplicate) {
    return json({ error: 'Already cancelled for this trip' }, 409)
  }

  // --- 9. INSERT parent_absence_reports ---
  const { data: absenceReport, error: insertAbsenceError } = await serviceClient
    .from('parent_absence_reports')
    .insert({
      passenger_id,
      route_session_id: tripId,
      reported_by_email: parentContact.email,
      reason: reasonText,
      status: 'new',
    })
    .select('id')
    .single()

  if (insertAbsenceError || !absenceReport) {
    console.error('Error inserting parent_absence_reports:', insertAbsenceError)
    return json({ error: 'Failed to record cancellation' }, 500)
  }

  // --- 10. INSERT notification ---
  const { error: insertNotifError } = await serviceClient
    .from('notifications')
    .insert({
      notification_type: 'trip_cancellation',
      status: 'pending',
      recipient_user_id: user.id,
      details: {
        passenger_id,
        passenger_name: passenger.full_name,
        trip_id: tripId,
        route_id: passenger.route_id,
        route_number: route.route_number,
        session_type,
        trip_date,
        parent_id: parentContact.id,
        parent_name: parentContact.full_name,
        reason: reasonText,
      },
    })

  if (insertNotifError) {
    // Non-fatal: absence report saved, notification failed — log but don't fail the request
    console.error('Error inserting trip_cancellation notification:', insertNotifError)
  }

  // --- 11. Return success ---
  return json({ absence_report_id: absenceReport.id }, 201)
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
