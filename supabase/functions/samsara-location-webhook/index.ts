/**
 * samsara-location-poller
 *
 * Polls Samsara's REST API for current vehicle locations + engine state and upserts:
 *   1. vehicles_realtime — live position + engine_state (1 row per vehicle, always overwritten)
 *
 * vehicle_telematics_history inserts have been removed — Phase 2 will introduce
 * vehicle_daily_snapshot for mileage/fuel reporting instead.
 *
 * Auto-mapping: if a Samsara vehicle has no samsara_vehicle_id in the DB yet,
 * this function matches it by licence plate (registration_normalized) and writes
 * samsara_vehicle_id automatically. No manual sync step required.
 *
 * NOTE: Samsara webhooks are event-driven (alerts, safety events) and do NOT
 * support continuous location streaming. Location data must be pulled via REST.
 *
 * Invocation:
 *   - Scheduled: VPS poller (fleet-poller repo) calls this endpoint every 5s
 *   - Manual:    POST with Authorization: Bearer <POLLER_SECRET>
 *
 * Environment secrets:
 *   SUPABASE_URL               — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY  — auto-injected
 *   SAMSARA_API_TOKEN          — your Samsara API key
 *   POLLER_SECRET              — shared secret used by the VPS poller (required)
 *   SAMSARA_SYNC_TOKEN         — legacy shared secret, still accepted for backwards compat
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SAMSARA_API_TOKEN         = Deno.env.get('SAMSARA_API_TOKEN') ?? ''
const SAMSARA_SYNC_TOKEN        = Deno.env.get('SAMSARA_SYNC_TOKEN') ?? ''
const POLLER_SECRET             = Deno.env.get('POLLER_SECRET') ?? ''
const SAMSARA_BASE_URL          = Deno.env.get('SAMSARA_API_BASE_URL') ?? 'https://api.eu.samsara.com'

// ── Types ──────────────────────────────────────────────────────────────────
interface SamsaraVehicle {
  id: string
  name?: string
  licensePlate?: string
}

// Response shape from GET /fleet/vehicles/stats?types=gps,engineStates
interface SamsaraVehicleStat {
  id: string
  name?: string
  gps?: {
    latitude?: number
    longitude?: number
    headingDegrees?: number
    speedMilesPerHour?: number
    time?: string
    reverseGeo?: { formattedLocation?: string }
  }
  engineState?: {
    value?: 'Off' | 'On' | 'Idle'
    time?: string
  }
}

type DbVehicle = {
  id: number
  samsara_vehicle_id: string | null
  vehicle_identifier: string | null
  registration: string | null
  registration_normalized: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────
function normalizeReg(plate: string | null | undefined): string {
  if (!plate) return ''
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return isFinite(n) ? n : null
  }
  return null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Samsara API calls (run in parallel) ───────────────────────────────────
async function samsaraGet<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SAMSARA_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${SAMSARA_API_TOKEN}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Samsara ${path} error (${res.status}): ${body}`)
  }
  const payload = await res.json() as { data?: T[] }
  return payload.data ?? []
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const legacyToken = req.headers.get('x-sync-token') ?? ''

  // Accept either POLLER_SECRET (new VPS poller) or SAMSARA_SYNC_TOKEN (legacy)
  const validSecrets = [POLLER_SECRET, SAMSARA_SYNC_TOKEN].filter(Boolean)
  if (validSecrets.length > 0) {
    const provided = bearerToken || legacyToken
    if (!provided || !validSecrets.includes(provided)) {
      return json({ error: 'Unauthorized' }, 401)
    }
  }

  if (!SAMSARA_API_TOKEN) {
    console.error('[samsara-poller] SAMSARA_API_TOKEN not set')
    return json({ error: 'SAMSARA_API_TOKEN not configured' }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. Load ALL vehicles from DB + fetch Samsara data in parallel ──────
  const [dbResult, samsaraResults] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, samsara_vehicle_id, vehicle_identifier, registration, registration_normalized'),
    Promise.all([
      samsaraGet<SamsaraVehicle>('/fleet/vehicles'),
      samsaraGet<SamsaraVehicleStat>('/fleet/vehicles/stats?types=gps,engineStates'),
    ]).catch((err): [[], []] => {
      console.error('[samsara-poller] Samsara API error:', err)
      return [[], []]
    }),
  ])

  if (dbResult.error) {
    console.error('[samsara-poller] DB error:', dbResult.error.message)
    return json({ error: 'DB error loading vehicles' }, 500)
  }

  const [samsaraVehicles, vehicleStats] = samsaraResults as [SamsaraVehicle[], SamsaraVehicleStat[]]

  if (vehicleStats.length === 0) {
    return json({ ok: true, message: 'No stats data from Samsara', updated: 0 })
  }

  const allDbVehicles = (dbResult.data ?? []) as DbVehicle[]

  // Map: samsara_vehicle_id → db vehicle (pre-mapped rows)
  const vehicleByVehicleId = new Map<string, DbVehicle>()
  for (const v of allDbVehicles) {
    if (v.samsara_vehicle_id) vehicleByVehicleId.set(v.samsara_vehicle_id, v)
  }

  // Map: registration_normalized → db vehicle (for auto-mapping)
  const vehicleByReg = new Map<string, DbVehicle>()
  for (const v of allDbVehicles) {
    const norm = v.registration_normalized ?? normalizeReg(v.registration)
    if (norm) vehicleByReg.set(norm, v)
  }

  // Map: samsara id → best available registration string (licensePlate first, then name)
  // In this fleet, vehicles are named by their reg plate in Samsara (e.g. "SH63 XMU")
  // and licensePlate is often blank, so we fall back to the vehicle name.
  const samsaraPlateById = new Map<string, string>()
  for (const sv of samsaraVehicles) {
    if (!sv.id) continue
    const plate = sv.licensePlate ?? sv.name ?? ''
    if (plate) samsaraPlateById.set(String(sv.id), plate)
  }

  const now = new Date().toISOString()
  let updated = 0
  let autoMapped = 0
  let unmatched = 0

  for (const stat of vehicleStats) {
    const samsaraVehicleId = String(stat.id ?? '')
    let vehicle = vehicleByVehicleId.get(samsaraVehicleId)

    // ── Auto-mapping: try to match by registration plate ────────────────
    if (!vehicle) {
      const plate = samsaraPlateById.get(samsaraVehicleId)
      const normPlate = normalizeReg(plate)

      if (normPlate) {
        const candidate = vehicleByReg.get(normPlate)
        if (candidate && !candidate.samsara_vehicle_id) {
          // Write samsara_vehicle_id onto the vehicles row
          const { error: mapErr } = await supabase
            .from('vehicles')
            .update({ samsara_vehicle_id: samsaraVehicleId })
            .eq('id', candidate.id)

          if (mapErr) {
            console.error('[samsara-poller] auto-map write error:', mapErr.message)
          } else {
            candidate.samsara_vehicle_id = samsaraVehicleId
            vehicleByVehicleId.set(samsaraVehicleId, candidate)
            vehicle = candidate
            autoMapped++
            console.log(`[samsara-poller] auto-mapped samsara ${samsaraVehicleId} → db vehicle ${candidate.id} (${normPlate})`)
          }
        }
      }
    }

    if (!vehicle) {
      unmatched++
      continue
    }

    const gps             = stat.gps ?? {}
    const reverseGeo      = gps.reverseGeo ?? {}
    const latitude        = parseNumber(gps.latitude)
    const longitude       = parseNumber(gps.longitude)
    const headingDeg      = parseNumber(gps.headingDegrees)
    const speedMph        = parseNumber(gps.speedMilesPerHour)
    const speedKph        = speedMph != null ? Number((speedMph * 1.609344).toFixed(2)) : null
    const locationTime    = gps.time ?? now
    const formattedLocation = reverseGeo.formattedLocation ?? null
    const engineState     = stat.engineState?.value ?? null

    const { error: upsertErr } = await supabase
      .from('vehicles_realtime')
      .upsert(
        {
          id:                 samsaraVehicleId,
          vehicle_db_id:      vehicle.id,
          name:               stat.name ?? vehicle.vehicle_identifier ?? vehicle.registration ?? samsaraVehicleId,
          latitude,
          longitude,
          heading:            headingDeg,
          speed:              speedKph,
          formatted_location: formattedLocation,
          location_time:      locationTime,
          engine_state:       engineState,
          updated_at:         now,
        },
        { onConflict: 'id' }
      )

    if (upsertErr) {
      console.error('[samsara-poller] upsert error for', samsaraVehicleId, upsertErr.message)
      continue
    }

    updated++
  }

  console.log(`[samsara-poller] updated=${updated} autoMapped=${autoMapped} unmatched=${unmatched} total=${vehicleStats.length}`)
  return json({ ok: true, updated, autoMapped, unmatched, total: vehicleStats.length, syncedAt: now })
})
