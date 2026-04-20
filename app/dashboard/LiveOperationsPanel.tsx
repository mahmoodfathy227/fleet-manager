'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { loadGoogleMapsScript } from '@/lib/google-maps-loader'
import { CLEAN_FLEET_MAP_STYLES } from '@/lib/google-maps-style'
import { Activity, Car, Clock3, Fuel, Power, Route, MapPinned } from 'lucide-react'

type VehicleRealtime = {
  id: string
  vehicle_db_id: number | null
  name: string | null
  latitude: number | null
  longitude: number | null
  heading: number | null
  speed: number | null
  engine_state: string | null
  formatted_location: string | null
  location_time: string | null
  updated_at: string | null
}

type LiveOpsResponse = {
  cards: {
    activeRoutes: number
    scheduledRoutesToday: number
    vehiclesMoving: number
    vehiclesIdling: number
    vehiclesEngineOff: number
    vehiclesNoSignal: number
    totalMileageTodayKm: number
    totalMileageThisWeekKm: number
    fuelUsedTodayLiters: number
    fuelUsedThisWeekLiters: number
    fuelDataUpdatedAt: string | null
  }
  map: {
    activeRoutes: Array<{
      routeId: number
      routeNumber: string | null
      schoolName: string | null
      vehicleId: number | null
      livePosition: {
        latitude: number | null
        longitude: number | null
        heading: number | null
        speedKph: number | null
        telematicsTimestamp: string | null
        stale: boolean
      } | null
      routePolyline: Array<{ lat: number; lng: number }>
    }>
    enRouteVehicles: Array<{
      id: number
      vehicle_identifier: string | null
      registration: string | null
      telematics: {
        latitude: number | null
        longitude: number | null
        speed_kph?: number | null
        telematics_timestamp?: string | null
        stale?: boolean
      } | null
    }>
    idleVehicles: Array<{
      id: number
      vehicle_identifier: string | null
      registration: string | null
      telematics: {
        latitude: number | null
        longitude: number | null
        speed_kph?: number | null
        telematics_timestamp?: string | null
        stale?: boolean
      } | null
      scheduledRoute: {
        sessionId: number
        routeId: number
        routeNumber: string | null
        sessionType: string | null
        started: boolean
      } | null
    }>
    completedRoutes: Array<{
      id: number
      route_id: number
      session_type: string | null
      ended_at: string | null
    }>
  }
}

declare global {
  interface Window {
    google: typeof google
  }
}

function fuelUpdatedLabel(iso?: string | null): string {
  if (!iso) return 'Unknown'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
    ' · ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function LiveOperationsPanel({
  mode = 'default',
}: {
  mode?: 'default' | 'full-screen'
}) {
  const [data, setData] = useState<LiveOpsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [routeFilter, setRouteFilter] = useState<string>('all')
  const [markerFilter, setMarkerFilter] = useState<'all' | 'assigned' | 'idle'>('all')
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null)
  const isFullScreen = mode === 'full-screen'

  useEffect(() => {
    console.debug('[fleet-dashboard] LiveOperationsPanel mount', { mode })
  }, [mode])

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const markerMapRef = useRef<Map<number, google.maps.Marker>>(new Map())
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const fitBoundsDoneRef = useRef(false)
  const realtimeVehiclesRef = useRef<Map<number, VehicleRealtime>>(new Map())
  const [mapReady, setMapReady] = useState(false)
  const [selectedVehicleRealtime, setSelectedVehicleRealtime] = useState<VehicleRealtime | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const selectedVehicleIdRef = useRef<number | null>(null)
  // Animation: batch updates into one RAF tick to eliminate per-vehicle stagger
  const pendingUpdatesRef = useRef<Map<number, VehicleRealtime>>(new Map())
  const rafScheduledRef = useRef(false)
  // Per-vehicle animation: frameId + current animated heading
  const animFrameRef = useRef<Map<number, number>>(new Map())
  const markerHeadingRef = useRef<Map<number, number>>(new Map())

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ''
  const shouldShowMap = !loading && !error && Boolean(apiKey)

  const fetchData = async (selectedRouteId?: string) => {
    try {
      setError(null)
      const query = new URLSearchParams()
      if (selectedRouteId && selectedRouteId !== 'all') {
        query.set('routeId', selectedRouteId)
      }
      const url = `/api/dashboard/live-ops${query.toString() ? `?${query.toString()}` : ''}`
      const response = await fetch(url, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch live operations')
      const payload = (await response.json()) as LiveOpsResponse
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Live operations unavailable')
    } finally {
      setLoading(false)
    }
  }

  // ── Stat cards: poll every 30s (route/session data from DB) ────────────
  useEffect(() => {
    void fetchData(routeFilter)
    const timer = setInterval(() => {
      void fetchData(routeFilter)
    }, 30000)
    return () => clearInterval(timer)
  }, [routeFilter])

  // ── Live positions: Supabase Realtime subscription on vehicles_realtime ─
  useEffect(() => {
    const supabase = createClient()
    // Seed initial positions immediately — no need to wait for the first WS push
    void supabase
      .from('vehicles_realtime')
      .select('*')
      .then(({ data }: { data: VehicleRealtime[] | null }) => {
        if (!data) return
        for (const row of data as VehicleRealtime[]) {
          if (!row.vehicle_db_id) continue
          realtimeVehiclesRef.current.set(row.vehicle_db_id, row)
          updateMarkerForVehicle(row)
        }
      })
    const channel = supabase
      .channel('vehicles_realtime_live')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'vehicles_realtime' },
        (payload: { new: VehicleRealtime }) => {
          const row = payload.new as VehicleRealtime
          if (!row?.vehicle_db_id) return
          realtimeVehiclesRef.current.set(row.vehicle_db_id, row)
          // Batch: queue the update; flush all pending in one RAF tick
          pendingUpdatesRef.current.set(row.vehicle_db_id, row)
          if (row.vehicle_db_id === selectedVehicleIdRef.current) {
            setSelectedVehicleRealtime(row)
          }
          if (!rafScheduledRef.current) {
            rafScheduledRef.current = true
            requestAnimationFrame(() => {
              rafScheduledRef.current = false
              const batch = new Map(pendingUpdatesRef.current)
              pendingUpdatesRef.current.clear()
              Array.from(batch.values()).forEach((r) => updateMarkerForVehicle(r))
            })
          }
        }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleRoutes = useMemo(() => {
    const routes = data?.map.activeRoutes || []
    if (routeFilter === 'all') return routes
    return routes.filter((route) => String(route.routeId) === routeFilter)
  }, [data, routeFilter])

  const hasActiveRoutes = (data?.map.activeRoutes.length || 0) > 0
  const effectiveMarkerFilter =
    !hasActiveRoutes && markerFilter === 'assigned' ? 'idle' : markerFilter

  const visibleAssignedVehicles = useMemo(() => {
    if (effectiveMarkerFilter === 'idle') return []
    return (data?.map.enRouteVehicles || []).filter((vehicle) => {
      if (routeFilter === 'all') return true
      return visibleRoutes.some((route) => route.vehicleId === vehicle.id)
    })
  }, [data, effectiveMarkerFilter, routeFilter, visibleRoutes])

  const visibleIdleVehicles = useMemo(() => {
    if (effectiveMarkerFilter === 'assigned') return []
    return data?.map.idleVehicles || []
  }, [data, effectiveMarkerFilter])

  const selectedVehicle = useMemo(() => {
    const assignedMatch = visibleAssignedVehicles.find((vehicle) => vehicle.id === selectedVehicleId)
    if (assignedMatch) {
      const assignedRoute = visibleRoutes.find((route) => route.vehicleId === assignedMatch.id)
      return {
        ...assignedMatch,
        status: 'assigned' as const,
        routeNumber: assignedRoute?.routeNumber || null,
        routeId: assignedRoute?.routeId || null,
      }
    }

    const idleMatch = visibleIdleVehicles.find((vehicle) => vehicle.id === selectedVehicleId)
    if (idleMatch) {
      return {
        ...idleMatch,
        status: 'idle' as const,
        routeNumber: idleMatch.scheduledRoute?.routeNumber ?? null,
        routeId: idleMatch.scheduledRoute?.routeId ?? null,
        scheduledRoute: idleMatch.scheduledRoute,
      }
    }

    return null
  }, [selectedVehicleId, visibleAssignedVehicles, visibleIdleVehicles, visibleRoutes])

  useEffect(() => {
    if (!selectedVehicleId) return
    const stillVisible =
      visibleAssignedVehicles.some((vehicle) => vehicle.id === selectedVehicleId) ||
      visibleIdleVehicles.some((vehicle) => vehicle.id === selectedVehicleId)
    if (!stillVisible) {
      setSelectedVehicleId(null)
    }
  }, [selectedVehicleId, visibleAssignedVehicles, visibleIdleVehicles])

  // Sync ref (used in Realtime closure) + init panel data when selection changes
  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId
    if (!selectedVehicleId) { setSelectedVehicleRealtime(null); return }
    setSelectedVehicleRealtime(realtimeVehiclesRef.current.get(selectedVehicleId) ?? null)
  }, [selectedVehicleId])

  useEffect(() => {
    if (!shouldShowMap || !mapRef.current || !apiKey) return
    let mounted = true

    const init = async () => {
      await loadGoogleMapsScript(apiKey, ['places'])
      if (!mounted || !mapRef.current || !window.google?.maps) return
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: { lat: 54, lng: -2 },
          zoom: 6,
          styles: CLEAN_FLEET_MAP_STYLES,
        })
        infoWindowRef.current = new window.google.maps.InfoWindow()
        setMapReady(true)
      }
    }

    void init().catch(() => setError('Map failed to load'))
    return () => {
      mounted = false
    }
  }, [apiKey, shouldShowMap])

  // ── Helper: derive marker icon from engine_state + speed ───────────────
  function getMarkerIcon(
    engineState: string | null,
    speedKph: number | null,
    heading: number | null,
    stale: boolean,
    selected: boolean
  ): google.maps.Symbol {
    const scale = selected ? 10 : 8
    if (stale || engineState === null) {
      // Stale / unknown — hollow gray circle
      return { path: window.google.maps.SymbolPath.CIRCLE, scale, fillColor: '#94a3b8', fillOpacity: 0.3, strokeColor: '#94a3b8', strokeWeight: 2 }
    }
    if (engineState === 'Off') {
      return { path: window.google.maps.SymbolPath.CIRCLE, scale, fillColor: '#64748b', fillOpacity: 1, strokeColor: '#1e293b', strokeWeight: selected ? 3 : 2 }
    }
    if (engineState === 'Idle' || (speedKph ?? 0) <= 3) {
      return { path: window.google.maps.SymbolPath.CIRCLE, scale, fillColor: '#f59e0b', fillOpacity: 1, strokeColor: '#92400e', strokeWeight: selected ? 3 : 2 }
    }
    // On + moving — directional arrow
    return {
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: selected ? 6 : 5,
      fillColor: '#16a34a',
      fillOpacity: 1,
      strokeColor: '#14532d',
      strokeWeight: selected ? 3 : 2,
      rotation: heading ?? 0,
    }
  }

  // ── Smooth marker animation: interpolate position + heading over polling interval ──
  function animateMarkerToPosition(
    vehicleDbId: number,
    marker: google.maps.Marker,
    row: VehicleRealtime
  ) {
    if (!window.google?.maps || row.latitude == null || row.longitude == null) return

    const toLat = Number(row.latitude)
    const toLng = Number(row.longitude)
    const toHeading = Number(row.heading ?? 0)

    // Cancel any in-progress animation for this vehicle
    const existingFrame = animFrameRef.current.get(vehicleDbId)
    if (existingFrame != null) cancelAnimationFrame(existingFrame)

    const currentPos = marker.getPosition()
    const fromLat = currentPos?.lat() ?? toLat
    const fromLng = currentPos?.lng() ?? toLng
    const fromHeading = markerHeadingRef.current.get(vehicleDbId) ?? toHeading

    const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const stale = !row.location_time || row.location_time < staleCutoff
    const isSelected = selectedVehicleIdRef.current === vehicleDbId

    // Shortest-path heading delta (avoid spinning the long way around)
    let dh = toHeading - fromHeading
    if (dh > 180) dh -= 360
    if (dh < -180) dh += 360

    // Snap immediately if distance is negligible (< ~30 m) — no animation needed
    const DEG_PER_M = 1 / 111_000
    const distSq = (toLat - fromLat) ** 2 + (toLng - fromLng) ** 2
    if (distSq < (30 * DEG_PER_M) ** 2) {
      marker.setPosition({ lat: toLat, lng: toLng })
      markerHeadingRef.current.set(vehicleDbId, toHeading)
      marker.setIcon(getMarkerIcon(row.engine_state, row.speed, toHeading, stale, isSelected))
      return
    }

    // Animate over slightly less than the polling interval so the vehicle
    // "arrives" just before the next position update lands
    const DURATION = 4800
    const startTime = performance.now()

    function tick(now: number) {
      const raw = Math.min((now - startTime) / DURATION, 1)
      // Ease-in-out cubic for natural deceleration
      const t = raw < 0.5 ? 4 * raw ** 3 : 1 - (-2 * raw + 2) ** 3 / 2

      const lat = fromLat + (toLat - fromLat) * t
      const lng = fromLng + (toLng - fromLng) * t
      const heading = fromHeading + dh * t

      marker.setPosition({ lat, lng })
      markerHeadingRef.current.set(vehicleDbId, heading)
      // Update icon on every frame so the arrow rotates smoothly
      marker.setIcon(getMarkerIcon(row.engine_state, row.speed, heading, stale, isSelected))

      if (t < 1) {
        animFrameRef.current.set(vehicleDbId, requestAnimationFrame(tick))
      } else {
        animFrameRef.current.delete(vehicleDbId)
      }
    }

    animFrameRef.current.set(vehicleDbId, requestAnimationFrame(tick))
  }

  // ── Helper: update or create a single marker from a realtime row ─────────
  function updateMarkerForVehicle(row: VehicleRealtime) {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps || !row.vehicle_db_id) return
    if (row.latitude == null || row.longitude == null) return

    const position = { lat: Number(row.latitude), lng: Number(row.longitude) }
    const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const stale = !row.location_time || row.location_time < staleCutoff
    const isSelected = selectedVehicleId === row.vehicle_db_id
    const icon = getMarkerIcon(row.engine_state, row.speed, row.heading, stale, isSelected)

    const existing = markerMapRef.current.get(row.vehicle_db_id)
    if (existing) {
      animateMarkerToPosition(row.vehicle_db_id, existing, row)
    } else {
      const marker = new window.google.maps.Marker({
        position,
        map,
        title: row.name ?? `Vehicle ${row.vehicle_db_id}`,
        icon,
      })
      marker.addListener('click', () => setSelectedVehicleId(row.vehicle_db_id!))
      marker.addListener('mouseover', () => {
        const latest = realtimeVehiclesRef.current.get(row.vehicle_db_id!) || row
        const engineLabel = latest.engine_state ?? 'Unknown'
        const speedLabel = latest.speed != null ? `${Number(latest.speed).toFixed(1)} km/h` : '—'
        const locLabel = latest.formatted_location ??
          (latest.latitude != null ? `${Number(latest.latitude).toFixed(4)}, ${Number(latest.longitude).toFixed(4)}` : '—')
        const timeLabel = latest.location_time
          ? new Date(latest.location_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          : '—'
        infoWindowRef.current?.setContent(
          `<div style="font-family:system-ui,sans-serif;padding:2px 4px;min-width:170px">` +
          `<div style="font-weight:600;font-size:13px;margin-bottom:6px">${latest.name ?? `Vehicle ${row.vehicle_db_id}`}</div>` +
          `<table style="font-size:11px;border-collapse:collapse;width:100%">` +
          `<tr><td style="color:#666;padding:2px 10px 2px 0">Engine</td><td style="font-weight:500">${engineLabel}</td></tr>` +
          `<tr><td style="color:#666;padding:2px 10px 2px 0">Speed</td><td style="font-weight:500">${speedLabel}</td></tr>` +
          `<tr><td style="color:#666;padding:2px 10px 2px 0">Location</td><td style="font-weight:500">${locLabel}</td></tr>` +
          `<tr><td style="color:#666;padding:2px 10px 2px 0">Updated</td><td style="font-weight:500">${timeLabel}</td></tr>` +
          `</table></div>`
        )
        infoWindowRef.current?.open(map, marker)
      })
      marker.addListener('mouseout', () => infoWindowRef.current?.close())
      markerMapRef.current.set(row.vehicle_db_id, marker)
      markersRef.current.push(marker)
    }
  }

  // ── Draw polylines on route change; seed initial markers from API data ───
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.google?.maps) return

    // Redraw polylines (routes change less frequently)
    polylinesRef.current.forEach((line) => line.setMap(null))
    polylinesRef.current = []

    const bounds = new window.google.maps.LatLngBounds()
    let hasBounds = false

    visibleRoutes.forEach((route) => {
      if (route.routePolyline.length > 1) {
        const polyline = new window.google.maps.Polyline({
          path: route.routePolyline,
          geodesic: true,
          strokeColor: '#2563eb',
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map,
        })
        polylinesRef.current.push(polyline)
        route.routePolyline.forEach((pt) => { bounds.extend(pt); hasBounds = true })
      }
    })

    // Seed markers from API data for vehicles not yet in realtimeVehiclesRef
    // (Realtime will take over updates once the first poller write arrives)
    const allApiVehicles = [
      ...visibleAssignedVehicles.map((v) => ({ ...v, isAssigned: true })),
      ...visibleIdleVehicles.map((v) => ({ ...v, isAssigned: false })),
    ]
    const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    allApiVehicles.forEach((vehicle) => {
      if (vehicle.telematics?.latitude == null || vehicle.telematics?.longitude == null) return
      const position = { lat: Number(vehicle.telematics.latitude), lng: Number(vehicle.telematics.longitude) }
      const stale = !vehicle.telematics?.telematics_timestamp || vehicle.telematics.telematics_timestamp < staleCutoff
      const isSelected = selectedVehicleId === vehicle.id
      // Use realtime data if already received, otherwise fall back to API data
      const rt = realtimeVehiclesRef.current.get(vehicle.id)
      const engineState = (rt?.engine_state) ?? (vehicle.isAssigned ? 'On' : 'Off')
      const speedKph = rt?.speed ?? vehicle.telematics?.speed_kph ?? null
      const heading = rt?.heading ?? null
      const icon = getMarkerIcon(engineState, speedKph, heading, stale, isSelected)

      const existing = markerMapRef.current.get(vehicle.id)
      if (existing) {
        existing.setPosition(position)
        existing.setIcon(icon)
      } else {
        const marker = new window.google.maps.Marker({
          position,
          map,
          title: vehicle.vehicle_identifier || vehicle.registration || `Vehicle ${vehicle.id}`,
          icon,
        })
        marker.addListener('click', () => setSelectedVehicleId(vehicle.id))
        marker.addListener('mouseover', () => {
          const latest = realtimeVehiclesRef.current.get(vehicle.id)
          const name = vehicle.vehicle_identifier || vehicle.registration || `Vehicle ${vehicle.id}`
          const engineLabel = latest?.engine_state ?? 'Unknown'
          const speedLabel = latest?.speed != null ? `${Number(latest.speed).toFixed(1)} km/h` : '—'
          const locLabel = latest?.formatted_location ??
            (latest?.latitude != null ? `${Number(latest.latitude).toFixed(4)}, ${Number(latest.longitude).toFixed(4)}` : '—')
          const timeLabel = latest?.location_time
            ? new Date(latest.location_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
            : '—'
          infoWindowRef.current?.setContent(
            `<div style="font-family:system-ui,sans-serif;padding:2px 4px;min-width:170px">` +
            `<div style="font-weight:600;font-size:13px;margin-bottom:6px">${name}</div>` +
            `<table style="font-size:11px;border-collapse:collapse;width:100%">` +
            `<tr><td style="color:#666;padding:2px 10px 2px 0">Engine</td><td style="font-weight:500">${engineLabel}</td></tr>` +
            `<tr><td style="color:#666;padding:2px 10px 2px 0">Speed</td><td style="font-weight:500">${speedLabel}</td></tr>` +
            `<tr><td style="color:#666;padding:2px 10px 2px 0">Location</td><td style="font-weight:500">${locLabel}</td></tr>` +
            `<tr><td style="color:#666;padding:2px 10px 2px 0">Updated</td><td style="font-weight:500">${timeLabel}</td></tr>` +
            `</table></div>`
          )
          infoWindowRef.current?.open(map, marker)
        })
        marker.addListener('mouseout', () => infoWindowRef.current?.close())
        markerMapRef.current.set(vehicle.id, marker)
        markersRef.current.push(marker)
      }
      bounds.extend(position)
      hasBounds = true
    })

    // Only fitBounds on very first data load
    if (hasBounds && !fitBoundsDoneRef.current) {
      map.fitBounds(bounds)
      fitBoundsDoneRef.current = true
    }
  }, [selectedVehicleId, visibleRoutes, visibleAssignedVehicles, visibleIdleVehicles, mapReady])

  const cards = data?.cards
  const routeOptions = data?.map.activeRoutes || []
  const mapHeightClass = isFullScreen
    ? 'h-[calc(100vh-260px)] min-h-[600px]'
    : 'h-[420px]'
  const uniqueRouteOptions = useMemo(() => {
    const seen = new Set<number>()
    return routeOptions.filter((r) => {
      if (seen.has(r.routeId)) return false
      seen.add(r.routeId)
      return true
    })
  }, [routeOptions])

  return (
    <Card className={`overflow-hidden border-slate-200 ${isFullScreen ? 'flex h-full min-h-[calc(100vh-180px)] flex-col' : ''}`}>
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <MapPinned className="h-5 w-5 text-slate-600" />
            Live Operations
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} selectSize="sm" className="min-w-[180px]">
              <option value="all">{hasActiveRoutes ? 'All active routes' : 'Fleet map view'}</option>
              {uniqueRouteOptions.map((route) => (
                <option key={route.routeId} value={String(route.routeId)}>
                  {route.routeNumber || `Route ${route.routeId}`}
                </option>
              ))}
            </Select>
            <Select
              value={markerFilter}
              onChange={(e) => setMarkerFilter(e.target.value as 'all' | 'assigned' | 'idle')}
              selectSize="sm"
              className="min-w-[160px]"
            >
              <option value="all">All vehicles</option>
              <option value="assigned">Assigned only</option>
              <option value="idle">Idle only</option>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className={`pt-4 space-y-4 ${isFullScreen ? 'flex flex-1 flex-col' : ''}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <StatChip icon={<Route className="h-3.5 w-3.5" />} label="Scheduled Today" value={cards?.scheduledRoutesToday ?? 0} tooltip="Number of routes scheduled to run today." />
          <StatChip icon={<Car className="h-3.5 w-3.5" />} label="Moving" value={cards?.vehiclesMoving ?? 0} tooltip="Vehicles currently travelling (engine on and speed > 0)." />
          <StatChip icon={<Activity className="h-3.5 w-3.5" />} label="Idling" value={cards?.vehiclesIdling ?? 0} tooltip="Vehicles with the engine running but stationary." />
          <StatChip icon={<Power className="h-3.5 w-3.5" />} label="Engine Off" value={cards?.vehiclesEngineOff ?? 0} tooltip="Vehicles with the engine switched off. Last position is known." />
          <StatChip icon={<Clock3 className="h-3.5 w-3.5" />} label="No Signal" value={cards?.vehiclesNoSignal ?? 0} tooltip="Vehicles that haven't reported a position in the last 10 minutes." />
          <StatChip label="Mileage Today" value={`${cards?.totalMileageTodayKm ?? 0} km`} tooltip={`Total distance driven by all vehicles since midnight (UTC). Resets each day.\n\nUpdated: ${fuelUpdatedLabel(cards?.fuelDataUpdatedAt)}`} />
          <StatChip label="Mileage Week" value={`${cards?.totalMileageThisWeekKm ?? 0} km`} tooltip={`Total distance driven by all vehicles since Monday midnight. Resets each Monday. Will match Today on Mondays.\n\nUpdated: ${fuelUpdatedLabel(cards?.fuelDataUpdatedAt)}`} />
          <StatChip icon={<Fuel className="h-3.5 w-3.5" />} label="Fuel Today" value={`${cards?.fuelUsedTodayLiters ?? 0} L`} tooltip={`Total fuel consumed by all vehicles since midnight (UTC). Resets each day.\n\nUpdated: ${fuelUpdatedLabel(cards?.fuelDataUpdatedAt)}`} />
          <StatChip icon={<Fuel className="h-3.5 w-3.5" />} label="Fuel Week" value={`${cards?.fuelUsedThisWeekLiters ?? 0} L`} tooltip={`Total fuel consumed by all vehicles since Monday midnight. Resets each Monday. Will match Today on Mondays.\n\nUpdated: ${fuelUpdatedLabel(cards?.fuelDataUpdatedAt)}`} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-slate-600"><span className="text-green-600 font-bold text-base leading-none">&#x25B2;</span> Moving</span>
          <Legend color="bg-amber-500" text="Idling" />
          <Legend color="bg-slate-500" text="Engine off" />
          <Legend color="bg-slate-300" text="No signal" />
        </div>

        {!loading && !error && !hasActiveRoutes && visibleIdleVehicles.length > 0 && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-sky-800">
                No active routes right now.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
                  Map Filter
                </span>
                <button
                  type="button"
                  onClick={() => setMarkerFilter('idle')}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    effectiveMarkerFilter === 'idle'
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-sky-800 border border-sky-200'
                  }`}
                >
                  Idle vehicles
                </button>
                <button
                  type="button"
                  onClick={() => setMarkerFilter('all')}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    effectiveMarkerFilter === 'all'
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-sky-800 border border-sky-200'
                  }`}
                >
                  All vehicles
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className={`${mapHeightClass} w-full rounded-lg border bg-slate-50 flex items-center justify-center text-slate-500`}>
            Loading live operations...
          </div>
        ) : error ? (
          <div className={`${mapHeightClass} w-full rounded-lg border bg-rose-50 flex items-center justify-center text-rose-700`}>
            {error}
          </div>
        ) : !apiKey ? (
          <div className={`${mapHeightClass} w-full rounded-lg border bg-amber-50 flex items-center justify-center text-amber-800`}>
            Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to display the live map.
          </div>
        ) : (
          <div ref={mapRef} className={`${mapHeightClass} w-full rounded-lg border border-slate-200`} />
        )}

        {selectedVehicle && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedVehicle.vehicle_identifier || selectedVehicle.registration || `Vehicle ${selectedVehicle.id}`}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedVehicle.registration || 'No registration'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    selectedVehicle.status === 'assigned'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {selectedVehicle.status === 'assigned' ? 'On run' : 'Unassigned'}
                </span>
                {selectedVehicleRealtime?.engine_state && (
                  <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    selectedVehicleRealtime.engine_state === 'On' && (selectedVehicleRealtime.speed ?? 0) > 3
                      ? 'bg-green-100 text-green-700'
                      : selectedVehicleRealtime.engine_state === 'Off'
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedVehicleRealtime.engine_state === 'On' && (selectedVehicleRealtime.speed ?? 0) > 3
                      ? 'Moving'
                      : selectedVehicleRealtime.engine_state === 'Off'
                      ? 'Engine off'
                      : 'Idling'}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-slate-600">
              <div>
                <p className="text-[11px] text-slate-500">Engine</p>
                <p className="font-medium">{selectedVehicleRealtime?.engine_state ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Speed</p>
                <p className="font-medium">
                  {selectedVehicleRealtime?.speed != null
                    ? `${Number(selectedVehicleRealtime.speed).toFixed(1)} km/h`
                    : selectedVehicle.telematics?.speed_kph != null
                    ? `${selectedVehicle.telematics.speed_kph} km/h`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Location</p>
                <p>
                  {selectedVehicleRealtime?.formatted_location ||
                    (selectedVehicleRealtime?.latitude != null
                      ? `${Number(selectedVehicleRealtime.latitude).toFixed(4)}, ${Number(selectedVehicleRealtime.longitude).toFixed(4)}`
                      : selectedVehicle.telematics?.latitude != null
                      ? `${selectedVehicle.telematics.latitude.toFixed(4)}, ${selectedVehicle.telematics.longitude?.toFixed(4)}`
                      : 'No coordinates')}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Updated</p>
                <p>
                  {(selectedVehicleRealtime?.location_time ?? selectedVehicle.telematics?.telematics_timestamp)
                    ? new Date((selectedVehicleRealtime?.location_time ?? selectedVehicle.telematics!.telematics_timestamp)!)
                        .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
                    : '—'}
                </p>
              </div>
            </div>

            {/* Route section */}
            <div className="mt-3 border-t border-slate-100 pt-3">
              {selectedVehicle.status === 'assigned' ? (
                <div className="text-xs">
                  <p className="text-[11px] text-slate-500">On run</p>
                  <p className="font-medium text-emerald-700">
                    {selectedVehicle.routeNumber || `Route ${selectedVehicle.routeId}`}
                  </p>
                </div>
              ) : (selectedVehicle as { scheduledRoute?: { started: boolean; routeNumber: string | null; routeId: number; sessionType: string | null } | null }).scheduledRoute ? (
                (() => {
                  const sr = (selectedVehicle as { scheduledRoute: { started: boolean; routeNumber: string | null; routeId: number; sessionType: string | null } }).scheduledRoute
                  return sr.started ? (
                    <div className="text-xs">
                      <p className="text-[11px] text-slate-500">Assigned route</p>
                      <p className="font-medium text-slate-800">
                        {sr.routeNumber || `Route ${sr.routeId}`}{sr.sessionType ? ` — ${sr.sessionType}` : ''}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
                      <span className="text-amber-500 mt-0.5 text-sm leading-none">⚠</span>
                      <div className="text-xs">
                        <p className="font-semibold text-amber-800">Session not started</p>
                        <p className="text-amber-700 mt-0.5">
                          This vehicle is scheduled for{' '}
                          <span className="font-medium">{sr.routeNumber || `Route ${sr.routeId}`}{sr.sessionType ? ` (${sr.sessionType})` : ''}</span>{' '}
                          but the driver has not started the session.
                        </p>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <p className="text-xs text-slate-500">No route scheduled for today</p>
              )}
            </div>

            <div className="mt-3 flex justify-end">
              <Link href={`/dashboard/vehicles/${selectedVehicle.id}`}>
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 transition-colors"
                >
                  Open vehicle profile
                </button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Active Routes</p>
            <div className="space-y-2 max-h-48 overflow-auto">
              {visibleRoutes.length === 0 ? (
                <p className="text-xs text-slate-500">No active routes.</p>
              ) : (
                visibleRoutes.map((route, index) => (
                  <div key={`active-${route.routeId}-${index}`} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <div>
                      <Link href={`/dashboard/routes/${route.routeId}`} className="font-semibold text-slate-800 hover:text-primary">
                        {route.routeNumber || `Route ${route.routeId}`}
                      </Link>
                      <p className="text-slate-500">{route.schoolName || 'No school linked'}</p>
                    </div>
                    {route.livePosition?.stale ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Stale</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Live</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Completed Today</p>
            <div className="space-y-2 max-h-48 overflow-auto">
              {(data?.map.completedRoutes || []).length === 0 ? (
                <p className="text-xs text-slate-500">No completed sessions today.</p>
              ) : (
                (data?.map.completedRoutes || []).map((item, index) => (
                  <div key={`completed-${item.id}-${item.route_id}-${item.session_type ?? ''}-${index}`} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <Link href={`/dashboard/routes/${item.route_id}`} className="text-slate-700 hover:text-primary">
                      Route {item.route_id}
                    </Link>
                    <span className="text-slate-500">{item.session_type || '—'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatChip({
  label,
  value,
  icon,
  tooltip,
}: {
  label: string
  value: string | number
  icon?: ReactNode
  tooltip?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        {icon}
        {label}
        {tooltip && (
          <span className="relative group ml-auto">
            <span className="cursor-default text-slate-400 hover:text-slate-600 transition-colors">&#9432;</span>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] leading-snug text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg whitespace-pre-line">
              {tooltip}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
            </span>
          </span>
        )}
      </p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-1">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-slate-600">{text}</span>
    </span>
  )
}
