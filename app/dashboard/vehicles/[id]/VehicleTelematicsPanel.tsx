'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
    formattedLocation: string | null
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
    formattedLocation: string | null
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
  // Live overrides from Supabase realtime
  const [realtimeLat, setRealtimeLat] = useState<number | null>(null)
  const [realtimeLng, setRealtimeLng] = useState<number | null>(null)
  const [realtimeHeading, setRealtimeHeading] = useState<number | null>(null)
  const [realtimeSpeed, setRealtimeSpeed] = useState<number | null>(null)
  const [realtimeEngineState, setRealtimeEngineState] = useState<string | null>(null)
  const [realtimeFormattedLocation, setRealtimeFormattedLocation] = useState<string | null>(null)
  const [realtimeUpdatedAt, setRealtimeUpdatedAt] = useState<string | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  // Animation refs
  const animFrameRef = useRef<number | null>(null)
  const markerHeadingRef = useRef<number>(0)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ''
  const shouldShowMap = !loading && !error && Boolean(apiKey)

  // Smooth animate marker to a new position
  const animateMarker = (
    marker: google.maps.Marker,
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    toHeading: number,
    engineState: string | null
  ) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    const dist = Math.sqrt((toLat - fromLat) ** 2 + (toLng - fromLng) ** 2) * 111000
    if (dist < 30) {
      marker.setPosition({ lat: toLat, lng: toLng })
      markerHeadingRef.current = toHeading
      updateMarkerIcon(marker, toHeading, engineState)
      return
    }
    const duration = 5000 // match the VPS poller interval so movement looks continuous
    const start = performance.now()
    const fromHead = markerHeadingRef.current
    let delta = toHeading - fromHead
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      // Linear — consistent speed that exactly fills the 5s gap between updates
      const lat = fromLat + (toLat - fromLat) * t
      const lng = fromLng + (toLng - fromLng) * t
      const heading = fromHead + delta * t
      markerHeadingRef.current = heading
      marker.setPosition({ lat, lng })
      updateMarkerIcon(marker, heading, engineState)
      if (t < 1) animFrameRef.current = requestAnimationFrame(step)
    }
    animFrameRef.current = requestAnimationFrame(step)
  }

  const updateMarkerIcon = (marker: google.maps.Marker, heading: number, engineState: string | null) => {
    if (!window.google?.maps) return
    const color = engineState === 'On' ? '#16a34a' : engineState === 'Idle' ? '#f59e0b' : '#64748b'
    marker.setIcon({
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 7,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#0f172a',
      strokeWeight: 1.5,
      rotation: heading,
    })
  }

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

    // Supabase realtime subscription — updates every ~5s from VPS poller
    const supabase = createClient()
    const channel = supabase
      .channel(`vehicle_telematics_${vehicleId}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, {
        event: '*',
        schema: 'public',
        table: 'vehicles_realtime',
        filter: `vehicle_db_id=eq.${vehicleId}`,
      }, (payload: { new: { latitude?: number; longitude?: number; heading?: number; speed?: number; engine_state?: string; formatted_location?: string; location_time?: string } }) => {
        const row = payload.new
        if (!row) return
        if (row.latitude != null) setRealtimeLat(row.latitude)
        if (row.longitude != null) setRealtimeLng(row.longitude)
        if (row.heading != null) setRealtimeHeading(row.heading)
        if (row.speed != null) setRealtimeSpeed(row.speed)
        if (row.engine_state != null) setRealtimeEngineState(row.engine_state)
        if (row.formatted_location != null) setRealtimeFormattedLocation(row.formatted_location)
        if (row.location_time != null) setRealtimeUpdatedAt(row.location_time)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
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
    if (!map || !window.google?.maps) return

    // Prefer realtime overrides, fall back to API data
    const source = data?.live || data?.lastKnown
    const lat = realtimeLat ?? (source?.latitude != null ? Number(source.latitude) : null)
    const lng = realtimeLng ?? (source?.longitude != null ? Number(source.longitude) : null)
    const heading = realtimeHeading ?? source?.heading ?? 0
    const engineState = realtimeEngineState ?? (source?.ignitionOn == null ? null : source.ignitionOn ? 'On' : 'Off')

    if (lat == null || lng == null) {
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      map.setCenter({ lat: 54, lng: -2 })
      map.setZoom(6)
      return
    }

    const position = { lat, lng }

    if (!markerRef.current) {
      markerRef.current = new window.google.maps.Marker({
        position,
        map,
        title: data?.vehicle.vehicle_identifier || data?.vehicle.registration || `Vehicle ${vehicleId}`,
      })
      markerHeadingRef.current = heading
      updateMarkerIcon(markerRef.current, heading, engineState)
      // InfoWindow — shows formatted address on marker click
      const infoWindow = new window.google.maps.InfoWindow()
      infoWindowRef.current = infoWindow
      markerRef.current.addListener('click', () => {
        infoWindow.open(map, markerRef.current)
      })
      map.setCenter(position)
      map.setZoom(14)
    } else {
      const prev = markerRef.current.getPosition()
      const fromLat = prev?.lat() ?? lat
      const fromLng = prev?.lng() ?? lng
      animateMarker(markerRef.current, fromLat, fromLng, lat, lng, heading, engineState)
      // Only re-center if the map hasn't been panned by user (pan if vehicle moved significantly)
      const dist = Math.sqrt((lat - fromLat) ** 2 + (lng - fromLng) ** 2) * 111000
      if (dist > 200) map.panTo(position)
    }

    // Keep InfoWindow content in sync with latest formatted address
    if (infoWindowRef.current) {
      const addr = realtimeFormattedLocation ?? data?.live?.formattedLocation ?? data?.lastKnown?.formattedLocation
      infoWindowRef.current.setContent(
        `<div style="font-size:12px;line-height:1.6;max-width:220px;padding:2px 4px">${addr ?? 'Location unknown'}</div>`
      )
    }
  }, [data, realtimeLat, realtimeLng, realtimeHeading, realtimeEngineState, realtimeFormattedLocation, vehicleId])

  const live = data?.live
  const fallback = data?.lastKnown

  // Prefer realtime overrides for display values
  const displayLat = realtimeLat ?? live?.latitude ?? fallback?.latitude
  const displayLng = realtimeLng ?? live?.longitude ?? fallback?.longitude
  const displaySpeed = realtimeSpeed ?? live?.speedKph
  const displayEngineState = realtimeEngineState ?? (live?.ignitionOn == null ? null : live.ignitionOn ? 'On' : 'Off')
  const displayUpdatedAt = realtimeUpdatedAt ?? live?.updatedAt ?? fallback?.updatedAt
  const displayFormattedLocation = realtimeFormattedLocation ?? live?.formattedLocation ?? fallback?.formattedLocation
  const freshnessMs = displayUpdatedAt ? Date.now() - new Date(displayUpdatedAt).getTime() : null
  const freshnessBadge =
    freshnessMs == null ? null
    : freshnessMs < 60_000 ? { label: 'Live', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    : freshnessMs < 300_000 ? { label: 'Delayed', className: 'bg-amber-100 text-amber-700 border-amber-200' }
    : { label: 'Offline', className: 'bg-slate-100 text-slate-600 border-slate-200' }
  const displayLocation =
    displayFormattedLocation && displayFormattedLocation.trim().length > 0
      ? displayFormattedLocation
      : displayLat != null && displayLng != null
        ? `${Number(displayLat).toFixed(5)}, ${Number(displayLng).toFixed(5)}`
        : 'N/A'

  return (
    <Card>
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500" />
          Live Telematics & Location
          {freshnessBadge && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${freshnessBadge.className}`}>
              {freshnessBadge.label}
            </span>
          )}
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
                {displayLocation}
              </Info>
              <Info label="Last Updated">
                {displayUpdatedAt
                  ? new Date(displayUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'No data'}
              </Info>
              <Info label="Engine">
                <span className="inline-flex items-center gap-1">
                  <Power className="h-3.5 w-3.5" />
                  {displayEngineState ?? 'N/A'}
                </span>
              </Info>
              <Info label="Speed">
                <span className="inline-flex items-center gap-1">
                  <Gauge className="h-3.5 w-3.5" />
                  {displaySpeed != null ? `${Number(displaySpeed).toFixed(1)} km/h` : 'N/A'}
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
