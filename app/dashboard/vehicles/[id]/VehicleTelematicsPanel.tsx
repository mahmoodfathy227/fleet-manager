'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { loadGoogleMapsScript } from '@/lib/google-maps-loader'
import { CLEAN_FLEET_MAP_STYLES } from '@/lib/google-maps-style'
import { Clock3, Fuel, Gauge, MapPin, Power, Route } from 'lucide-react'

type VehicleTelematicsResponse = {
  vehicle: {
    id: number
    vehicle_identifier: string | null
    registration: string | null
    samsara_vehicle_id: string | null
  }
  live: {
    latitude: number | null
    longitude: number | null
    heading: number | null
    speedKph: number | null
    ignitionOn: boolean | null
    odometerKm: number | null
    fuelUsedLiters: number | null
    updatedAt: string | null
    stale: boolean
    dataSource?: string
  } | null
  lastKnown: {
    latitude: number | null
    longitude: number | null
    heading: number | null
    speedKph: number | null
    ignitionOn: boolean | null
    odometerKm: number | null
    fuelUsedLiters: number | null
    updatedAt: string | null
  } | null
  activeRoute: {
    sessionId: number
    routeId: number
    sessionType: string | null
    startedAt: string | null
    routeNumber: string | null
    status: 'active'
  } | null
}

declare global {
  interface Window {
    google: typeof google
  }
}

export default function VehicleTelematicsPanel({ vehicleId }: { vehicleId: number }) {
  const [data, setData] = useState<VehicleTelematicsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ''
  const shouldShowMap = !loading && !error && Boolean(apiKey)

  useEffect(() => {
    const fetchTelematics = async () => {
      try {
        setError(null)
        const response = await fetch(`/api/vehicles/${vehicleId}/telematics`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load telematics')
        const payload = (await response.json()) as VehicleTelematicsResponse
        setData(payload)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Telematics unavailable')
      } finally {
        setLoading(false)
      }
    }

    void fetchTelematics()
    const timer = setInterval(() => void fetchTelematics(), 20000)
    return () => clearInterval(timer)
  }, [vehicleId])

  useEffect(() => {
    if (!shouldShowMap || !mapRef.current || !apiKey) return
    let mounted = true

    const init = async () => {
      await loadGoogleMapsScript(apiKey, ['places'])
      if (!mounted || !mapRef.current || !window.google?.maps) return
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: 54, lng: -2 },
          zoom: 10,
          styles: CLEAN_FLEET_MAP_STYLES,
        })
      }
    }

    void init().catch(() => setError('Map failed to load'))
    return () => {
      mounted = false
    }
  }, [apiKey, shouldShowMap])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !data || !window.google?.maps) return

    const source = data.live || data.lastKnown
    if (source?.latitude == null || source?.longitude == null) {
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      map.setCenter({ lat: 54, lng: -2 })
      map.setZoom(6)
      return
    }

    const position = { lat: Number(source.latitude), lng: Number(source.longitude) }

    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position,
        map,
        title: data.vehicle.vehicle_identifier || data.vehicle.registration || `Vehicle ${data.vehicle.id}`,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: data.live?.stale ? '#f59e0b' : '#16a34a',
          fillOpacity: 1,
          strokeColor: '#14532d',
          strokeWeight: 1.5,
          rotation: source.heading || 0,
        },
      })
    } else {
      markerRef.current.setPosition(position)
      markerRef.current.setIcon({
        path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 7,
        fillColor: data.live?.stale ? '#f59e0b' : '#16a34a',
        fillOpacity: 1,
        strokeColor: '#14532d',
        strokeWeight: 1.5,
        rotation: source.heading || 0,
      })
    }

    map.setCenter(position)
    map.setZoom(13)
  }, [data])

  const live = data?.live
  const fallback = data?.lastKnown

  return (
    <Card>
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500" />
          Live Telematics & Location
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading telematics...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : (
          <>
            {!live && fallback && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Live signal currently unavailable. Showing last known location snapshot.
              </div>
            )}

            {live?.stale && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" />
                Data is stale. Last update is older than threshold.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Info label="Current Location">
                {live?.latitude != null && live?.longitude != null
                  ? `${live.latitude.toFixed(5)}, ${live.longitude.toFixed(5)}`
                  : fallback?.latitude != null && fallback?.longitude != null
                    ? `${fallback.latitude.toFixed(5)}, ${fallback.longitude.toFixed(5)}`
                    : 'N/A'}
              </Info>
              <Info label="Last Updated">
                {live?.updatedAt
                  ? new Date(live.updatedAt).toLocaleString()
                  : fallback?.updatedAt
                    ? new Date(fallback.updatedAt).toLocaleString()
                    : 'No data'}
              </Info>
              <Info label="Ignition">
                <span className="inline-flex items-center gap-1">
                  <Power className="h-3.5 w-3.5" />
                  {live?.ignitionOn == null ? 'N/A' : live.ignitionOn ? 'On' : 'Off'}
                </span>
              </Info>
              <Info label="Speed">
                <span className="inline-flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" />
                  {live?.speedKph != null ? `${live.speedKph} km/h` : 'N/A'}
                </span>
              </Info>
              <Info label="Odometer">{live?.odometerKm != null ? `${live.odometerKm} km` : 'N/A'}</Info>
              <Info label="Fuel Used">
                <span className="inline-flex items-center gap-1">
                  <Fuel className="h-3.5 w-3.5" />
                  {live?.fuelUsedLiters != null ? `${live.fuelUsedLiters} L` : 'N/A'}
                </span>
              </Info>
              <Info label="Assigned Route">
                {data?.activeRoute ? (
                  <Link href={`/dashboard/routes/${data.activeRoute.routeId}`} className="text-primary hover:underline">
                    {data.activeRoute.routeNumber || `Route ${data.activeRoute.routeId}`}
                  </Link>
                ) : (
                  'None'
                )}
              </Info>
              <Info label="Route Status">
                {data?.activeRoute ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Route className="h-3.5 w-3.5" />
                    {data.activeRoute.status}
                  </span>
                ) : (
                  'Idle'
                )}
              </Info>
            </div>

            {!apiKey ? (
              <div className="h-[280px] rounded-lg border bg-amber-50 flex items-center justify-center text-amber-800 text-sm">
                Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to display map.
              </div>
            ) : (
              <div ref={mapRef} className="h-[280px] w-full rounded-lg border border-slate-200" />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <p className="font-medium text-slate-800 break-words">{children}</p>
    </div>
  )
}
