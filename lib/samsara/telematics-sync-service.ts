import { createServiceClient } from '@/lib/supabase/service'
import { SamsaraApiClient } from '@/lib/samsara/client'
import { TelematicsSyncResult } from '@/lib/samsara/types'

function toIsoTimestamp(value: string | null): string {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

export async function syncTelematicsSnapshots(): Promise<TelematicsSyncResult> {
  const supabase = createServiceClient()
  const samsaraClient = new SamsaraApiClient()
  const startedAt = new Date().toISOString()

  const { data: logRow } = await supabase
    .from('samsara_sync_logs')
    .insert({
      sync_type: 'telematics_snapshot',
      status: 'running',
      started_at: startedAt,
    })
    .select('id')
    .maybeSingle()

  const logId = logRow?.id ?? null
  let processed = 0
  let updated = 0
  let failed = 0

  try {
    const { data: mappedVehicles } = await supabase
      .from('vehicles')
      .select('id, samsara_vehicle_id')
      .not('samsara_vehicle_id', 'is', null)

    const vehicleRows = mappedVehicles || []
    const samsaraIds = vehicleRows
      .map((row) => row.samsara_vehicle_id)
      .filter((id): id is string => Boolean(id))

    processed = samsaraIds.length

    if (samsaraIds.length === 0) {
      await supabase
        .from('samsara_sync_logs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          records_processed: 0,
          records_matched: 0,
          records_failed: 0,
        })
        .eq('id', logId)

      return { processed: 0, updated: 0, failed: 0, logId }
    }

    const telemetryRows = await samsaraClient.getVehicleTelemetry(samsaraIds)
    const vehicleBySamsaraId = new Map(
      vehicleRows.map((row) => [row.samsara_vehicle_id as string, row.id])
    )

    for (const telemetry of telemetryRows) {
      const vehicleId = vehicleBySamsaraId.get(telemetry.samsaraVehicleId)
      if (!vehicleId) {
        failed += 1
        continue
      }

      try {
        const telematicsTimestamp = toIsoTimestamp(telemetry.telematicsTimestamp)
        const nowIso = new Date().toISOString()

        await supabase
          .from('vehicle_telematics_latest')
          .upsert(
            {
              vehicle_id: vehicleId,
              samsara_vehicle_id: telemetry.samsaraVehicleId,
              latitude: telemetry.latitude,
              longitude: telemetry.longitude,
              heading: telemetry.heading,
              speed_kph: telemetry.speedKph,
              ignition_on: telemetry.ignitionOn,
              odometer_km: telemetry.odometerKm,
              fuel_used_liters: telemetry.fuelUsedLiters,
              telematics_timestamp: telematicsTimestamp,
              last_sync_at: nowIso,
              raw_payload: telemetry.rawPayload,
              data_source: 'samsara',
            },
            { onConflict: 'vehicle_id' }
          )

        await supabase.from('vehicle_telematics_history').insert({
          vehicle_id: vehicleId,
          samsara_vehicle_id: telemetry.samsaraVehicleId,
          latitude: telemetry.latitude,
          longitude: telemetry.longitude,
          heading: telemetry.heading,
          speed_kph: telemetry.speedKph,
          ignition_on: telemetry.ignitionOn,
          odometer_km: telemetry.odometerKm,
          fuel_used_liters: telemetry.fuelUsedLiters,
          telematics_timestamp: telematicsTimestamp,
          synced_at: nowIso,
          raw_payload: telemetry.rawPayload,
        })

        updated += 1
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
        records_matched: updated,
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
        records_matched: updated,
        records_failed: failed,
        error_summary: error instanceof Error ? error.message : 'Unknown telematics sync error',
      })
      .eq('id', logId)

    throw error
  }

  return {
    processed,
    updated,
    failed,
    logId,
  }
}
