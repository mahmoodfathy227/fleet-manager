import { SamsaraVehicle, SamsaraVehicleTelemetry } from '@/lib/samsara/types'

const DEFAULT_BASE_URL = 'https://api.samsara.com'

interface SamsaraListVehiclesResponse {
  data?: Array<Record<string, unknown>>
}

interface SamsaraVehicleStatsResponse {
  data?: Array<Record<string, unknown>>
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseTelemetryRow(row: Record<string, unknown>): SamsaraVehicleTelemetry {
  const gps = (row.gps as Record<string, unknown> | undefined) || {}
  const location = (row.location as Record<string, unknown> | undefined) || {}
  const engine = (row.engine as Record<string, unknown> | undefined) || {}
  const fuel = (row.fuel as Record<string, unknown> | undefined) || {}
  const odometer = (row.odometerMeters as Record<string, unknown> | undefined) || {}

  const latitude = parseNumber(gps.latitude) ?? parseNumber(location.latitude)
  const longitude = parseNumber(gps.longitude) ?? parseNumber(location.longitude)
  const heading = parseNumber(gps.headingDegrees)
  const speedMph = parseNumber(gps.speedMilesPerHour)
  const speedKph =
    speedMph != null
      ? Number((speedMph * 1.609344).toFixed(2))
      : parseNumber(gps.speedKilometersPerHour)

  const odometerMeters = parseNumber(odometer.value)
  const odometerKm =
    odometerMeters != null ? Number((odometerMeters / 1000).toFixed(3)) : null

  return {
    samsaraVehicleId: String(row.id ?? ''),
    latitude,
    longitude,
    heading,
    speedKph,
    ignitionOn: typeof engine.ignitionOn === 'boolean' ? engine.ignitionOn : null,
    odometerKm,
    fuelUsedLiters: parseNumber(fuel.totalFuelUsedLiters),
    telematicsTimestamp:
      (gps.time as string | undefined) ||
      (location.time as string | undefined) ||
      (row.time as string | undefined) ||
      null,
    rawPayload: row,
  }
}

export class SamsaraApiClient {
  private readonly token: string
  private readonly baseUrl: string

  constructor() {
    const token = process.env.SAMSARA_API_TOKEN || process.env.SAMSARA_TOKEN
    if (!token) {
      throw new Error('SAMSARA_API_TOKEN (or SAMSARA_TOKEN) is required')
    }
    if (!process.env.SAMSARA_API_TOKEN && process.env.SAMSARA_TOKEN) {
      console.debug('[fleet samsara] using SAMSARA_TOKEN; prefer SAMSARA_API_TOKEN in .env.local')
    }
    this.token = token
    const base =
      process.env.SAMSARA_API_BASE_URL ||
      process.env.SAMSARA_BASE_URL ||
      DEFAULT_BASE_URL
    if (!process.env.SAMSARA_API_BASE_URL && process.env.SAMSARA_BASE_URL) {
      console.debug('[fleet samsara] using SAMSARA_BASE_URL; prefer SAMSARA_API_BASE_URL in .env.local')
    }
    this.baseUrl = base.replace(/\/$/, '')
  }

  private async request<T>(path: string, query?: Record<string, string>): Promise<T> {
    const queryString = query ? `?${new URLSearchParams(query).toString()}` : ''
    const url = `${this.baseUrl}${path}${queryString}`
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Samsara request failed (${response.status}): ${body}`)
    }

    return (await response.json()) as T
  }

  async listVehicles(): Promise<SamsaraVehicle[]> {
    const response = await this.request<SamsaraListVehiclesResponse>('/fleet/vehicles')
    const rows = response.data || []

    return rows.map((row) => {
      const externalIds = (row.externalIds as Record<string, string> | undefined) || undefined
      return {
        id: String(row.id ?? ''),
        name: (row.name as string | undefined) ?? null,
        externalIds,
        licensePlate: (row.licensePlate as string | undefined) ?? null,
        registration:
          (row.licensePlate as string | undefined) ??
          (externalIds?.registration as string | undefined) ??
          null,
      }
    })
  }

  async getVehicleTelemetry(ids: string[]): Promise<SamsaraVehicleTelemetry[]> {
    if (ids.length === 0) return []
    const response = await this.request<SamsaraVehicleStatsResponse>('/fleet/vehicles/stats', {
      ids: ids.join(','),
      types: 'gps,engineStates,obdOdometerMeters,fuelPercents',
    })

    return (response.data || [])
      .map((row) => parseTelemetryRow(row))
      .filter((row) => Boolean(row.samsaraVehicleId))
  }
}
