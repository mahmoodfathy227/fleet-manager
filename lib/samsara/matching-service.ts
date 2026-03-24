import { createServiceClient } from '@/lib/supabase/service'
import { normalizeRegistration } from '@/lib/samsara/registration'
import { SamsaraApiClient } from '@/lib/samsara/client'
import { VehicleMappingSyncResult } from '@/lib/samsara/types'

type MatchResult =
  | { kind: 'matched'; vehicleId: number; confidence: 'exact' | 'normalized' }
  | { kind: 'unmatched'; reason: 'no_match' | 'multiple_matches' | 'missing_registration' }

async function matchInternalVehicleByRegistration(
  registration: string | null
): Promise<MatchResult> {
  const normalized = normalizeRegistration(registration)
  const supabase = createServiceClient()

  if (!normalized) {
    return { kind: 'unmatched', reason: 'missing_registration' }
  }

  const { data: exactRows } = await supabase
    .from('vehicles')
    .select('id, registration')
    .eq('registration', registration)
    .limit(2)

  if ((exactRows || []).length === 1) {
    return { kind: 'matched', vehicleId: exactRows![0].id, confidence: 'exact' }
  }

  const { data: normalizedRows } = await supabase
    .from('vehicles')
    .select('id, registration_normalized')
    .eq('registration_normalized', normalized)
    .limit(2)

  if ((normalizedRows || []).length === 1) {
    return { kind: 'matched', vehicleId: normalizedRows![0].id, confidence: 'normalized' }
  }

  if ((normalizedRows || []).length > 1) {
    return { kind: 'unmatched', reason: 'multiple_matches' }
  }

  return { kind: 'unmatched', reason: 'no_match' }
}

export async function syncVehicleMappingsFromSamsara(): Promise<VehicleMappingSyncResult> {
  const supabase = createServiceClient()
  const samsaraClient = new SamsaraApiClient()
  const start = new Date().toISOString()

  const { data: logRow } = await supabase
    .from('samsara_sync_logs')
    .insert({
      sync_type: 'vehicle_mapping',
      status: 'running',
      started_at: start,
    })
    .select('id')
    .maybeSingle()

  const logId = logRow?.id ?? null
  let processed = 0
  let matched = 0
  let unmatched = 0
  let failed = 0

  try {
    const vehicles = await samsaraClient.listVehicles()
    processed = vehicles.length

    for (const samsaraVehicle of vehicles) {
      try {
        const registration = samsaraVehicle.registration || null
        const normalized = normalizeRegistration(registration)
        const match = await matchInternalVehicleByRegistration(registration)

        if (match.kind === 'matched') {
          matched += 1

          const { data: current } = await supabase
            .from('vehicles')
            .select('samsara_vehicle_id')
            .eq('id', match.vehicleId)
            .maybeSingle()

          await supabase
            .from('vehicles')
            .update({
              samsara_vehicle_id: samsaraVehicle.id,
              registration_normalized: normalized || null,
              samsara_last_mapping_sync_at: new Date().toISOString(),
            })
            .eq('id', match.vehicleId)

          if ((current?.samsara_vehicle_id || null) !== samsaraVehicle.id) {
            await supabase.from('samsara_mapping_audit_log').insert({
              vehicle_id: match.vehicleId,
              old_samsara_vehicle_id: current?.samsara_vehicle_id || null,
              new_samsara_vehicle_id: samsaraVehicle.id,
              action: 'auto_sync',
              reason: `registration_${match.confidence}_match`,
              metadata: {
                registration,
                normalized_registration: normalized || null,
              },
            })
          }

          await supabase
            .from('samsara_vehicle_unmatched')
            .delete()
            .eq('external_vehicle_id', samsaraVehicle.id)
        } else {
          unmatched += 1
          await supabase
            .from('samsara_vehicle_unmatched')
            .upsert(
              {
                external_vehicle_id: samsaraVehicle.id,
                external_registration_raw: registration,
                normalized_registration: normalized || null,
                reason: match.reason,
                first_seen_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
                status: 'open',
              },
              { onConflict: 'external_vehicle_id' }
            )
        }
      } catch (error) {
        failed += 1
      }
    }

    await supabase
      .from('samsara_sync_logs')
      .update({
        status: failed > 0 ? 'partial_success' : 'success',
        finished_at: new Date().toISOString(),
        records_processed: processed,
        records_matched: matched,
        records_unmatched: unmatched,
        records_failed: failed,
      })
      .eq('id', logId)
  } catch (error) {
    await supabase
      .from('samsara_sync_logs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        records_processed: processed,
        records_matched: matched,
        records_unmatched: unmatched,
        records_failed: failed,
        error_summary: error instanceof Error ? error.message : 'Unknown mapping sync error',
      })
      .eq('id', logId)

    throw error
  }

  return {
    processed,
    matched,
    unmatched,
    failed,
    logId,
  }
}
