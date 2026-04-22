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

function isToday(isoString: string | null): boolean {
  if (!isoString) return false
  const d = new Date(isoString)
  const now = new Date()
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
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

  const dataIsToday = isToday(data.updated_at)
  const stale = !dataIsToday

  // For today column: if data is not from today, show '--'
  const todayVal = <T,>(val: T, formatter: (v: T) => string) =>
    stale ? '—' : formatter(val)

  const updatedAtStr = data.updated_at
    ? new Date(data.updated_at).toLocaleString('en-GB', {
        timeZone: 'Europe/London',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : null

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Fuel &amp; Distance</h3>
          {updatedAtStr && (
            <span className={`text-xs ${stale ? 'text-amber-600' : 'text-gray-400'}`}>
              Last updated: {updatedAtStr}
            </span>
          )}
        </div>

        {stale && (
          <div className="mb-3 flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            No Samsara data received today — today&apos;s figures shown as —
          </div>
        )}

        {/* Column headers */}
        <div className="grid grid-cols-3 gap-2 mb-1">
          <span className="text-xs text-gray-400" />
          <span className="text-xs text-gray-400 text-center font-medium">Today</span>
          <span className="text-xs text-gray-400 text-center font-medium">This Week</span>
        </div>

        <StatRow label="Distance"    today={todayVal(data.distance_today_m, km)}     week={km(data.distance_week_m)} />
        <StatRow label="Fuel used"   today={todayVal(data.fuel_today_ml, liters)}    week={liters(data.fuel_week_ml)} />
        <StatRow label="Engine time" today={todayVal(data.engine_time_today_ms, hours)} week={hours(data.engine_time_week_ms)} />
        <StatRow label="Idle time"   today={todayVal(data.idle_time_today_ms, hours)}   week={hours(data.idle_time_week_ms)} />
        <StatRow label="CO₂"         today={todayVal(data.carbon_today_kg, co2)}     week={co2(data.carbon_week_kg)} />

        <div className="grid grid-cols-3 gap-2 py-2 border-b border-gray-100">
          <span className="text-sm text-gray-500">Efficiency</span>
          <span className="text-sm font-medium text-center">
            {stale ? '—' : mpgFromRaw(data.distance_today_m, data.fuel_today_ml)}
          </span>
          <span className="text-sm font-medium text-center">{mpg(data.efficiency_mpg)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
