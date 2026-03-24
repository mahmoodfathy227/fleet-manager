'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { loadGoogleMapsScript } from '@/lib/google-maps-loader'
import { CLEAN_FLEET_MAP_STYLES } from '@/lib/google-maps-style'
import { AlertTriangle, Clock3, MapPin, Route, Truck } from 'lucide-react'

type RouteLiveResponse = {
  route: {
    id: number
    routeNumber: string | null
    school: string | null
    status: 'not_started' | 'active' | 'completed'
    startedAt: string | null
    endedAt: string | null
    sessionType: string | null
    assignedDriverId: number | null
    assignedPassengerAssistantId: number | null
  }
  assignedVehicle: {
    id?: number
    vehicle_identifier?: string | null
    registration?: string | null
  } | null
  telematics: {
    latitude: number | null
    longitude: number | null
    heading: number | null
    speedKph: number | null
    ignitionOn: boolean | null
    odometerKm: number | null
    fuelUsedLiters: number | null
    telematicsTimestamp: string | null
    stale: boolean
    ageMs: number | null
  } | null
  progress: {
    percent: number
    closestPointIndex: number
    distanceToClosestMeters: number | null
    offRoute: boolean
  }
  routePoints: Array<{
    id: number
    point_name: string | null
    stop_order: number | null
    latitude: number | null
    longitude: number | null
  }>
  routePolyline: Array<{ lat: number; lng: number }>
  eta: {
    status: 'placeholder'
    value: string | null
  }
}

declare global {
  interface Window {
    google: typeof google
  }
}

export default function RouteLiveTrackingPanel({ routeId }: { routeId: number }) {
  const [data, setData] = useState<RouteLiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylinesRef = useRef<google.maps.Polyline[]>([])

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ''
  const shouldShowMap = !loading && !error && !!data && Boolean(apiKey)

  useEffect(() => {
    const fetchLive = async () => {
      try {
        setError(null)
        const response = await fetch(`/api/routes/${routeId}/live`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Failed to load route live data')
        const payload = (await response.json()) as RouteLiveResponse
        setData(payload)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Live route data unavailable')
      } finally {
        setLoading(false)
      }
    }

    void fetchLive()
    const timer = setInterval(() => void fetchLive(), 20000)
    return () => clearInterval(timer)
  }, [routeId])

  useEffect(() => {
    if (!shouldShowMap || !mapRef.current || !apiKey) return
    let mounted = true

    const init = async () => {
      await loadGoogleMapsScript(apiKey, ['places'])
      if (!mounted || !mapRef.current || !window.google?.maps) return
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: 54, lng: -2 },
          zoom: 9,
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

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []
    polylinesRef.current.forEach((line) => line.setMap(null))
    polylinesRef.current = []

    const bounds = new window.google.maps.LatLngBounds()
    let hasBounds = false

    if (data.routePolyline.length > 1) {
      const line = new window.google.maps.Polyline({
        path: data.routePolyline,
        geodesic: true,
        strokeColor: '#2563eb',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map,
      })
      polylinesRef.current.push(line)
      data.routePolyline.forEach((point) => {
        bounds.extend(point)
        hasBounds = true
      })
    }

    data.routePoints.forEach((point) => {
      if (point.latitude == null || point.longitude == null) return
      const marker = new window.google.maps.Marker({
        position: { lat: Number(point.latitude), lng: Number(point.longitude) },
        map,
        title: point.point_name || `Stop ${point.stop_order ?? ''}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: '#334155',
          fillOpacity: 0.9,
          strokeColor: '#0f172a',
          strokeWeight: 1,
        },
      })
      markersRef.current.push(marker)
      bounds.extend({ lat: Number(point.latitude), lng: Number(point.longitude) })
      hasBounds = true
    })

    if (data.telematics?.latitude != null && data.telematics?.longitude != null) {
      const livePosition = {
        lat: Number(data.telematics.latitude),
        lng: Number(data.telematics.longitude),
      }
      const liveMarker = new window.google.maps.Marker({
        position: livePosition,
        map,
        title: data.assignedVehicle?.vehicle_identifier || data.assignedVehicle?.registration || 'Assigned vehicle',
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: data.telematics.stale ? '#f59e0b' : '#16a34a',
          fillOpacity: 1,
          strokeColor: '#14532d',
          strokeWeight: 1.5,
          rotation: data.telematics.heading || 0,
        },
      })
      markersRef.current.push(liveMarker)
      bounds.extend(livePosition)
      hasBounds = true
    }

    if (hasBounds) {
      map.fitBounds(bounds)
    } else {
      map.setCenter({ lat: 54, lng: -2 })
      map.setZoom(9)
    }
  }, [data])

  const statusBadge =
    data?.route.status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : data?.route.status === 'completed'
        ? 'bg-slate-200 text-slate-700'
        : 'bg-amber-100 text-amber-700'

  return (
    <Card>
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Route className="h-4 w-4 text-slate-500" />
          Route Live Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading live tracking...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Info label="Status">
                <span className={`px-2 py-0.5 rounded-full ${statusBadge}`}>{data.route.status}</span>
              </Info>
              <Info label="Assigned Vehicle">
                {data.assignedVehicle?.vehicle_identifier || data.assignedVehicle?.registration || 'Not assigned'}
              </Info>
              <Info label="Driver">{data.route.assignedDriverId ?? 'N/A'}</Info>
              <Info label="Last Update">
                {data.telematics?.telematicsTimestamp
                  ? new Date(data.telematics.telematicsTimestamp).toLocaleTimeString()
                  : 'No telemetry'}
              </Info>
              <Info label="Current Speed">{data.telematics?.speedKph != null ? `${data.telematics.speedKph} km/h` : 'N/A'}</Info>
              <Info label="Journey Progress">{data.progress.percent}%</Info>
              <Info label="ETA (placeholder)">{data.eta.value || 'Pending future ETA model'}</Info>
              <Info label="Deviation">{data.progress.offRoute ? 'Off route' : 'On route'}</Info>
            </div>

            {data.progress.offRoute && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Vehicle appears off planned route. Review route assignment or route geometry.
              </div>
            )}

            {data.telematics?.stale && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" />
                Telemetry is stale. Last update older than configured threshold.
              </div>
            )}

            {!apiKey ? (
              <div className="h-[340px] rounded-lg border bg-amber-50 flex items-center justify-center text-amber-800 text-sm">
                Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to display route map.
              </div>
            ) : (
              <div ref={mapRef} className="h-[340px] w-full rounded-lg border border-slate-200" />
            )}

            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Planned route line
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Live vehicle marker
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> Stops/checkpoints
              </span>
            </div>

            <div className="text-xs text-slate-600">
              <Link
                href={`/dashboard/vehicles/${data.assignedVehicle?.id ?? ''}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Truck className="h-3.5 w-3.5" />
                Open assigned vehicle detail
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">No live route data.</p>
        )}
      </CardContent>
    </Card>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
      <p className="text-[11px] text-slate-500 mb-0.5">{label}</p>
      <p className="font-medium text-slate-800">{children}</p>
    </div>
  )
}
