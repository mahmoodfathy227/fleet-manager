export interface SamsaraVehicle {
  id: string
  name?: string | null
  externalIds?: Record<string, string>
  licensePlate?: string | null
  registration?: string | null
}

export interface SamsaraVehicleTelemetry {
  samsaraVehicleId: string
  latitude: number | null
  longitude: number | null
  heading: number | null
  speedKph: number | null
  ignitionOn: boolean | null
  odometerKm: number | null
  fuelUsedLiters: number | null
  telematicsTimestamp: string | null
  rawPayload: unknown
}

export interface TelematicsSyncResult {
  processed: number
  updated: number
  failed: number
  logId: number | null
}

export interface VehicleMappingSyncResult {
  processed: number
  matched: number
  unmatched: number
  failed: number
  logId: number | null
}
