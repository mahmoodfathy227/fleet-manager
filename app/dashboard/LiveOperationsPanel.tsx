'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { loadGoogleMapsScript } from '@/lib/google-maps-loader'
import { CLEAN_FLEET_MAP_STYLES } from '@/lib/google-maps-style'
import { Activity, Car, Clock3, Fuel, Route, MapPinned } from 'lucide-react'

type LiveOpsResponse = {
  cards: {
    activeRoutes: number
    vehiclesEnRoute: number
    vehiclesIdle: number
    noRecentLocationUpdate: number
    totalMileageTodayKm: number
    totalMileageThisWeekKm: number
    fuelUsedTodayLiters: number
    fuelUsedThisWeekLiters: number
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

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylinesRef = useRef<google.maps.Polyline[]>([])

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

  useEffect(() => {
    void fetchData(routeFilter)
    const timer = setInterval(() => {
      void fetchData(routeFilter)
    }, 30000)
    return () => clearInterval(timer)
  }, [routeFilter])

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
        routeNumber: null,
        routeId: null,
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

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []
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
        route.routePolyline.forEach((pt) => {
          bounds.extend(pt)
          hasBounds = true
        })
      }
    })

    visibleAssignedVehicles.forEach((vehicle) => {
      if (vehicle.telematics?.latitude == null || vehicle.telematics?.longitude == null) return
      const position = {
        lat: Number(vehicle.telematics.latitude),
        lng: Number(vehicle.telematics.longitude),
      }
      const marker = new window.google.maps.Marker({
        position,
        map,
        title: vehicle.vehicle_identifier || vehicle.registration || `Vehicle ${vehicle.id}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: selectedVehicleId === vehicle.id ? 10 : 8,
          fillColor: '#16a34a',
          fillOpacity: 1,
          strokeColor: '#14532d',
          strokeWeight: selectedVehicleId === vehicle.id ? 3 : 2,
        },
      })
      marker.addListener('click', () => setSelectedVehicleId(vehicle.id))
      markersRef.current.push(marker)
      bounds.extend(position)
      hasBounds = true
    })

    visibleIdleVehicles.forEach((vehicle) => {
      if (vehicle.telematics?.latitude == null || vehicle.telematics?.longitude == null) return
      const position = {
        lat: Number(vehicle.telematics.latitude),
        lng: Number(vehicle.telematics.longitude),
      }
      const marker = new window.google.maps.Marker({
        position,
        map,
        title: vehicle.vehicle_identifier || vehicle.registration || `Vehicle ${vehicle.id}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: selectedVehicleId === vehicle.id ? 9 : 7,
          fillColor: '#64748b',
          fillOpacity: 1,
          strokeColor: '#1e293b',
          strokeWeight: selectedVehicleId === vehicle.id ? 3 : 2,
        },
      })
      marker.addListener('click', () => setSelectedVehicleId(vehicle.id))
      markersRef.current.push(marker)
      bounds.extend(position)
      hasBounds = true
    })

    if (hasBounds) {
      map.fitBounds(bounds)
    } else {
      map.setCenter({ lat: 54, lng: -2 })
      map.setZoom(6)
    }
  }, [selectedVehicleId, visibleRoutes, visibleAssignedVehicles, visibleIdleVehicles])

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
        {!isFullScreen && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <StatChip icon={<Route className="h-3.5 w-3.5" />} label="Active Routes" value={cards?.activeRoutes ?? 0} />
            <StatChip icon={<Car className="h-3.5 w-3.5" />} label="En Route" value={cards?.vehiclesEnRoute ?? 0} />
            <StatChip icon={<Activity className="h-3.5 w-3.5" />} label="Idle" value={cards?.vehiclesIdle ?? 0} />
            <StatChip icon={<Clock3 className="h-3.5 w-3.5" />} label="No Update" value={cards?.noRecentLocationUpdate ?? 0} />
            <StatChip label="Mileage Today" value={`${cards?.totalMileageTodayKm ?? 0} km`} />
            <StatChip label="Mileage Week" value={`${cards?.totalMileageThisWeekKm ?? 0} km`} />
            <StatChip icon={<Fuel className="h-3.5 w-3.5" />} label="Fuel Today" value={`${cards?.fuelUsedTodayLiters ?? 0} L`} />
            <StatChip icon={<Fuel className="h-3.5 w-3.5" />} label="Fuel Week" value={`${cards?.fuelUsedThisWeekLiters ?? 0} L`} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Legend color="bg-blue-500" text="Active route polyline" />
          <Legend color="bg-green-500" text="Assigned vehicle" />
          <Legend color="bg-slate-500" text="Idle vehicle" />
          <Legend color="bg-amber-500" text="Completed route (list)" />
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
          <div className="h-[420px] rounded-lg border bg-slate-50 flex items-center justify-center text-slate-500">
            Loading live operations...
          </div>
        ) : error ? (
          <div className="h-[420px] rounded-lg border bg-rose-50 flex items-center justify-center text-rose-700">
            {error}
          </div>
        ) : !apiKey ? (
          <div className="h-[420px] rounded-lg border bg-amber-50 flex items-center justify-center text-amber-800">
            Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to display the live map.
          </div>
        ) : (
          <div ref={mapRef} className={`${mapHeightClass} w-full rounded-lg border border-slate-200`} />
        )}

        {selectedVehicle && (
          <Link href={`/dashboard/vehicles/${selectedVehicle.id}`} className="block">
            <div className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedVehicle.vehicle_identifier || selectedVehicle.registration || `Vehicle ${selectedVehicle.id}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedVehicle.registration || 'No registration'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    selectedVehicle.status === 'assigned'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {selectedVehicle.status === 'assigned' ? 'Assigned' : 'Idle'}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-slate-600">
                <div>
                  <p className="text-[11px] text-slate-500">Location</p>
                  <p>
                    {selectedVehicle.telematics?.latitude != null && selectedVehicle.telematics?.longitude != null
                      ? `${selectedVehicle.telematics.latitude.toFixed(5)}, ${selectedVehicle.telematics.longitude.toFixed(5)}`
                      : 'No coordinates'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Speed</p>
                  <p>
                    {selectedVehicle.telematics?.speed_kph != null
                      ? `${selectedVehicle.telematics.speed_kph} km/h`
                      : 'Idle'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Last Update</p>
                  <p>
                    {selectedVehicle.telematics?.telematics_timestamp
                      ? new Date(selectedVehicle.telematics.telematics_timestamp).toLocaleString()
                      : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Route</p>
                  <p>
                    {selectedVehicle.routeId
                      ? selectedVehicle.routeNumber || `Route ${selectedVehicle.routeId}`
                      : 'No active route'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs font-medium text-primary">Open vehicle profile</p>
            </div>
          </Link>
        )}

        {!isFullScreen && (
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
        )}
      </CardContent>
    </Card>
  )
}

function StatChip({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        {icon}
        {label}
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
