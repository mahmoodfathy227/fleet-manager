'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'

interface FuelDistanceData {
  distance_today_m: number | null
  fuel_today_ml: number | null
  engine_time_today_ms: number | null
  idle_time_today_ms: number | null
  carbon_today_kg: number | null
  distance_week_m: number | null
  fuel_week_ml: number | null
  engine_time_week_ms: number | null
  idle_time_week_ms: number | null
  carbon_week_kg: number | null
  efficiency_mpg: number | null
  updated_at: string | null
}

function km(meters: number | null): string {
  if (meters == null) return '—'
  return `${(meters / 1000).toFixed(1)} km`
}

function liters(ml: number | null): string {
  if (ml == null) return '—'
  return `${(ml / 1000).toFixed(1)} L`
}

function hours(ms: number | null): string {
  if (ms == null) return '—'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function mpg(value: number | null): string {
  if (value == null || value === 0) return '—'
  return `${value.toFixed(1)} mpg`
}

function mpgFromRaw(distanceM: number | null, fuelMl: number | null): string {
  if (!distanceM || !fuelMl || fuelMl === 0) return '—'
  const miles = (distanceM / 1000) * 0.621371
  const gallons = (fuelMl / 1000) / 3.78541   // US gallons — matches Samsara's efficiencyMpge
  return `${(miles / gallons).toFixed(1)} mpg`
}

function co2(kg: number | null): string {
  if (kg == null) return '—'
  return `${kg.toFixed(1)} kg`
}

interface StatRowProps {
  label: string
  today: string
  week: string
}

function StatRow({ label, today, week }: StatRowProps) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-center">{today}</span>
      <span className="text-sm font-medium text-center">{week}</span>
    </div>
  )
}

export default function VehicleFuelDistancePanel({ vehicleId }: { vehicleId: number }) {
  const [data, setData] = useState<FuelDistanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/vehicles/${vehicleId}/fuel-distance`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ data, error }) => {
        if (error) setError(error)
        else setData(data ?? null)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [vehicleId])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-gray-400 animate-pulse">Loading fuel &amp; distance data…</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-red-500">Failed to load fuel &amp; distance data.</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-gray-400">No fuel &amp; distance data yet — data is refreshed every 15 minutes.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Fuel &amp; Distance</h3>

        {/* Column headers */}
        <div className="grid grid-cols-3 gap-2 mb-1">
          <span className="text-xs text-gray-400" />
          <span className="text-xs text-gray-400 text-center font-medium">Today</span>
          <span className="text-xs text-gray-400 text-center font-medium">This Week</span>
        </div>

        <StatRow label="Distance"    today={km(data.distance_today_m)}   week={km(data.distance_week_m)} />
        <StatRow label="Fuel used"   today={liters(data.fuel_today_ml)}  week={liters(data.fuel_week_ml)} />
        <StatRow label="Engine time" today={hours(data.engine_time_today_ms)} week={hours(data.engine_time_week_ms)} />
        <StatRow label="Idle time"   today={hours(data.idle_time_today_ms)}   week={hours(data.idle_time_week_ms)} />
        <StatRow label="CO₂"         today={co2(data.carbon_today_kg)}   week={co2(data.carbon_week_kg)} />

        <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-100">
          <span className="text-sm text-gray-500">Efficiency</span>
          <span className="text-sm font-medium text-center">{mpgFromRaw(data.distance_today_m, data.fuel_today_ml)}</span>
          <span className="text-sm font-medium text-center">{mpg(data.efficiency_mpg)}</span>
        </div>

        {data.updated_at && (
          <p className="text-xs text-gray-400 mt-3">
            Last synced: {new Date(data.updated_at).toLocaleString('en-GB', {
              timeZone: 'Europe/London',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
