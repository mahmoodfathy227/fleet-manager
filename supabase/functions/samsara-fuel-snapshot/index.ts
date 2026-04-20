/**
 * samsara-fuel-snapshot
 *
 * Calls Samsara's /fleet/reports/vehicles/fuel-energy endpoint twice per invocation:
 *   1. Today window  (midnight UK time → now)
 *   2. This week window (Monday 00:00 UK → now)
 *
 * Upserts one row per vehicle into vehicle_fuel_distance (keyed on vehicle_db_id).
 *
 * Called by the VPS fleet-poller on a day/night cadence:
 *   - School hours (05:00–18:00 UK): every 15 minutes
 *   - Overnight: every 2 hours
 *
 * Auth: Bearer POLLER_SECRET (same shared secret as samsara-location-webhook)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
// SAMSARA_FUEL_TOKEN — Samsara Global Read token (has Fuel & Energy scope).
// Separate from SAMSARA_API_TOKEN used by samsara-location-webhook (which only
// needs GPS/engine-state scope and uses the older, narrower token).
const SAMSARA_API_TOKEN         = Deno.env.get('SAMSARA_FUEL_TOKEN') ?? ''
const POLLER_SECRET             = Deno.env.get('POLLER_SECRET') ?? ''
const SAMSARA_BASE_URL          = Deno.env.get('SAMSARA_API_BASE_URL') ?? 'https://api.eu.samsara.com'

interface SamsaraFuelRow {
  vehicle: { id: string; name?: string }
  distanceTraveledMeters: number
  fuelConsumedMl: number
  efficiencyMpge: number
  engineRunTimeDurationMs: number
  engineIdleTimeDurationMs: number
  estCarbonEmissionsKg: number
}

type DbVehicle = {
  id: number
  samsara_vehicle_id: string | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** UTC midnight today (used as the start-of-day boundary for Samsara fuel windows).
 * Using UTC avoids locale-string parsing issues in the edge runtime.
 * The max error vs true UK midnight is 1 hour (BST offset) — irrelevant for daily fuel totals. */
function ukMidnightToday(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/** UTC Monday 00:00 this week. */
function ukMondayThisWeek(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()         // 0=Sun, 1=Mon …
  const diff = (day + 6) % 7       // days since Monday
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString()
}

async function fetchFuelReport(startDate: string, endDate: string, after?: string): Promise<SamsaraFuelRow[]> {
  const url = new URL(`${SAMSARA_BASE_URL}/fleet/reports/vehicles/fuel-energy`)
  url.searchParams.set('startDate', startDate)
  url.searchParams.set('endDate', endDate)
  if (after) url.searchParams.set('after', after)

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${SAMSARA_API_TOKEN}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Samsara fuel-energy error (${res.status}): ${body}`)
  }

  const payload = await res.json() as {
    data?: { vehicleReports?: SamsaraFuelRow[] }
    pagination?: { hasNextPage: boolean; endCursor: string }
  }
  const rows: SamsaraFuelRow[] = payload.data?.vehicleReports ?? []

  // Handle pagination
  if (payload.pagination?.hasNextPage) {
    const more = await fetchFuelReport(startDate, endDate, payload.pagination.endCursor)
    return [...rows, ...more]
  }

  return rows
}

Deno.serve(async (req: Request) => {
  try {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (POLLER_SECRET && token !== POLLER_SECRET) return json({ error: 'Unauthorized' }, 401)

  if (!SAMSARA_API_TOKEN) return json({ error: 'SAMSARA_FUEL_TOKEN not configured' }, 500)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now = new Date().toISOString()
  const todayStart  = ukMidnightToday()
  const weekStart   = ukMondayThisWeek()

  // Load DB vehicles for samsara_vehicle_id → db id mapping
  const { data: dbVehicles, error: dbErr } = await supabase
    .from('vehicles')
    .select('id, samsara_vehicle_id')

  if (dbErr) return json({ error: `DB error: ${dbErr.message}` }, 500)

  const vehicleByVehicleId = new Map<string, DbVehicle>()
  for (const v of (dbVehicles ?? []) as DbVehicle[]) {
    if (v.samsara_vehicle_id) vehicleByVehicleId.set(v.samsara_vehicle_id, v)
  }

  // Fetch today + week reports in parallel
  let todayRows: SamsaraFuelRow[] = []
  let weekRows: SamsaraFuelRow[] = []

  try {
    const results = await Promise.all([
      fetchFuelReport(todayStart, now),
      fetchFuelReport(weekStart, now),
    ])
    todayRows = results[0]
    weekRows = results[1]
  } catch (err) {
    console.error('[samsara-fuel-snapshot] Samsara API error:', err)
    return json({ error: String(err) }, 502)
  }

  // Index week rows by samsara vehicle id
  const weekByVehicleId = new Map<string, SamsaraFuelRow>()
  for (const row of weekRows) weekByVehicleId.set(row.vehicle.id, row)

  let upserted = 0
  let unmatched = 0

  for (const todayRow of todayRows) {
    const samsaraId = todayRow.vehicle.id
    const vehicle = vehicleByVehicleId.get(samsaraId)
    if (!vehicle) { unmatched++; continue }

    const week = weekByVehicleId.get(samsaraId)

    const { error: upsertErr } = await supabase
      .from('vehicle_fuel_distance')
      .upsert({
        vehicle_db_id:        vehicle.id,
        samsara_vehicle_id:   samsaraId,

        distance_today_m:     todayRow.distanceTraveledMeters,
        fuel_today_ml:        todayRow.fuelConsumedMl,
        engine_time_today_ms: todayRow.engineRunTimeDurationMs,
        idle_time_today_ms:   todayRow.engineIdleTimeDurationMs,
        carbon_today_kg:      todayRow.estCarbonEmissionsKg,

        distance_week_m:      week?.distanceTraveledMeters  ?? todayRow.distanceTraveledMeters,
        fuel_week_ml:         week?.fuelConsumedMl          ?? todayRow.fuelConsumedMl,
        engine_time_week_ms:  week?.engineRunTimeDurationMs ?? todayRow.engineRunTimeDurationMs,
        idle_time_week_ms:    week?.engineIdleTimeDurationMs?? todayRow.engineIdleTimeDurationMs,
        carbon_week_kg:       week?.estCarbonEmissionsKg    ?? todayRow.estCarbonEmissionsKg,

        // Use week efficiency — more meaningful than a single day
        efficiency_mpg:       week?.efficiencyMpge ?? todayRow.efficiencyMpge,

        updated_at: now,
      }, { onConflict: 'vehicle_db_id' })

    if (upsertErr) {
      console.error('[samsara-fuel-snapshot] upsert error:', vehicle.id, upsertErr.message)
    } else {
      upserted++
    }
  }

  console.log(`[samsara-fuel-snapshot] upserted=${upserted} unmatched=${unmatched} syncedAt=${now}`)
  return json({ ok: true, upserted, unmatched, syncedAt: now })
  } catch (topErr) {
    console.error('[samsara-fuel-snapshot] Unhandled error:', topErr)
    return json({ error: String(topErr) }, 500)
  }
})
