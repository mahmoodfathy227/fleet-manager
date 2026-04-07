/**
 * push-notification-relay
 *
 * Supabase Edge Function triggered by a Database Webhook on the `notifications`
 * table (INSERT events). Translates each notification row into a human-readable
 * push notification and delivers it to the recipient's devices via Firebase FCM
 * by calling the `notifyInternal` Firebase Cloud Function.
 *
 * Only rows with a non-null `recipient_user_id` are forwarded — admin-only
 * notifications (breakdown reports, compliance alerts, etc.) are ignored here
 * because admins use the dashboard, not the Flutter app.
 *
 * Environment secrets (set via `supabase secrets set`):
 *   FIREBASE_NOTIFY_URL   — https://us-central1-county-cars-af6d1.cloudfunctions.net/notifyInternal
 *   INTERNAL_RELAY_SECRET — shared secret, must match the Firebase INTERNAL_RELAY_SECRET secret
 */

const FIREBASE_NOTIFY_URL = Deno.env.get('FIREBASE_NOTIFY_URL') ?? ''
const INTERNAL_RELAY_SECRET = Deno.env.get('INTERNAL_RELAY_SECRET') ?? ''

// ── Types ──────────────────────────────────────────────────────────────────

interface NotificationRow {
  id: number
  notification_type: string
  recipient_user_id: string | null
  status: string
  details: Record<string, unknown> | null
  created_at: string
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: NotificationRow
  schema: string
  old_record: NotificationRow | null
}

interface PushMessage {
  title: string
  body: string
  data: Record<string, string>
}

// ── Notification templates ─────────────────────────────────────────────────
// Maps notification_type → { title, body } using values from the details JSONB.
// Returns null for types that should NOT send a push (admin-only types).

function buildMessage(row: NotificationRow): PushMessage | null {
  const d = row.details ?? {}
  const type = row.notification_type

  const passengerName = String(d.passenger_name ?? 'Your child')
  const stopName      = d.stop_name ? String(d.stop_name) : null
  const sessionType   = d.session_type ? String(d.session_type) : 'trip'
  const certName      = d.cert_name   ? String(d.cert_name)   : String(d.display_name ?? 'Certificate')
  const expiryDate    = d.expiry_date ? String(d.expiry_date) : ''
  const displayName   = d.display_name ? String(d.display_name) : certName

  const at = stopName ? ` at ${stopName}` : ''

  switch (type) {
    case 'driver_at_stop':
      return {
        title: 'Bus arriving',
        body:  `${passengerName}'s bus has arrived${at}. Please make your way to the stop.`,
        data:  { type, route_session_id: String(d.route_session_id ?? '') },
      }

    case 'child_picked_up':
      return {
        title: 'Child picked up',
        body:  `${passengerName} has been picked up${at}.`,
        data:  { type, route_session_id: String(d.route_session_id ?? '') },
      }

    case 'child_dropped_off':
      return {
        title: 'Child dropped off',
        body:  `${passengerName} has been dropped off${at}.`,
        data:  { type, route_session_id: String(d.route_session_id ?? '') },
      }

    case 'child_no_show':
      return {
        title: 'Child not at stop',
        body:  `${passengerName} was not at the stop${at}. Please contact the office.`,
        data:  { type, route_session_id: String(d.route_session_id ?? '') },
      }

    case 'trip_started':
      return {
        title: 'Trip started',
        body:  `${passengerName}'s ${sessionType} bus has departed. Your driver is on the way.`,
        data:  { type, route_session_id: String(d.route_session_id ?? ''), route_id: String(d.route_id ?? '') },
      }

    case 'trip_completed':
      return {
        title: 'Trip completed',
        body:  `${passengerName}'s ${sessionType} trip has completed successfully.`,
        data:  { type, route_session_id: String(d.route_session_id ?? '') },
      }

    case 'child_not_on_trip':
      return {
        title: 'Trip ended — child not recorded',
        body:  `${passengerName} was not recorded on today's trip. Please contact the office.`,
        data:  { type, route_session_id: String(d.route_session_id ?? '') },
      }

    case 'trip_cancellation':
      return {
        title: 'Trip cancelled',
        body:  `${passengerName}'s ${sessionType} trip has been cancelled.`,
        data:  { type },
      }

    case 'trip_restored':
      return {
        title: 'Trip restored',
        body:  `${passengerName}'s ${sessionType} trip has been reinstated.`,
        data:  { type },
      }

    case 'cert_expiry_reminder': {
      const severity = String(d.severity ?? '')
      const isExpired = severity === 'expired'
      return {
        title: isExpired ? `${certName} expired` : `${certName} expiring soon`,
        body:  isExpired
          ? `${displayName} has expired.`
          : `${displayName} expires on ${expiryDate}. Please renew it as soon as possible.`,
        data:  { type, entity_type: String(d.entity_type ?? ''), cert_type: String(d.cert_type ?? '') },
      }
    }

    case 'new_agreement':
      return {
        title: 'Action required',
        body:  `There's a new ${String(d.type ?? 'notice')} you need to review and agree to before continuing.`,
        data:  { type, agreement_id: String(d.agreement_id ?? '') },
      }

    default:
      // Unknown or admin-only type — do not send push
      return null
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json() as WebhookPayload
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Only act on INSERT events on the notifications table
  if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
    return new Response(JSON.stringify({ ok: true, skipped: 'not an insert on notifications' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const row = payload.record

  // Skip notifications without a specific recipient (admin-only, handled by dashboard)
  if (!row.recipient_user_id) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no recipient_user_id' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const message = buildMessage(row)
  if (!message) {
    return new Response(JSON.stringify({ ok: true, skipped: `no template for type: ${row.notification_type}` }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!FIREBASE_NOTIFY_URL) {
    console.error('[push-relay] FIREBASE_NOTIFY_URL not set')
    return new Response(JSON.stringify({ error: 'FIREBASE_NOTIFY_URL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!INTERNAL_RELAY_SECRET) {
    console.error('[push-relay] INTERNAL_RELAY_SECRET not set')
    return new Response(JSON.stringify({ error: 'INTERNAL_RELAY_SECRET not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Call Firebase notifyInternal
  const firebaseRes = await fetch(FIREBASE_NOTIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-relay-secret': INTERNAL_RELAY_SECRET,
    },
    body: JSON.stringify({
      userId:                 row.recipient_user_id,
      title:                  message.title,
      body:                   message.body,
      supabaseNotificationId: String(row.id),
      notification_type:      row.notification_type,
      details:                row.details ?? {},
      data:                   message.data,
    }),
  })

  if (!firebaseRes.ok) {
    const errorText = await firebaseRes.text()
    console.error(`[push-relay] Firebase call failed (${firebaseRes.status}):`, errorText)
    // Return 200 so Supabase webhook does not retry — the push is best-effort
    return new Response(JSON.stringify({ ok: false, firebaseStatus: firebaseRes.status, error: errorText }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await firebaseRes.json()
  console.log(`[push-relay] notif ${row.id} (${row.notification_type}) → userId=${row.recipient_user_id} sent=${result.sentCount}`)

  return new Response(JSON.stringify({ ok: true, notificationId: result.notificationId, sentCount: result.sentCount }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
