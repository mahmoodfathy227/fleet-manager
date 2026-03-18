'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsScript } from '@/lib/google-maps-loader'

interface VehicleLocation {
  id: number
  location_name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  last_updated: string
  vehicles?: {
    vehicle_identifier: string | null
    make: string | null
    model: string | null
    registration: string | null
    spare_vehicle: boolean
    off_the_road: boolean | null
  }
}

interface VehicleLocationsMapProps {
  locations: VehicleLocation[]
  apiKey: string
}

// Extend Window interface to include google
declare global {
  interface Window {
    google: typeof google
  }
}

export function VehicleLocationsMap({ locations, apiKey }: VehicleLocationsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const initMap = async () => {
      setLoading(true)
      setMapError(null)

      try {
        // Load Google Maps API (will prevent duplicates)
        await loadGoogleMapsScript(apiKey, ['places'])

        // Google Maps API is now available globally
        if (!mapRef.current || !window.google || !window.google.maps) {
          if (isMounted) {
            setMapError('Google Maps API failed to initialize')
            setLoading(false)
          }
          return
        }

        const mapInstance = new window.google.maps.Map(mapRef.current, {
            center: { lat: 0, lng: 0 },
            zoom: 2,
            mapId: 'VEHICLE_LOCATIONS_MAP',
          })

          const bounds = new window.google.maps.LatLngBounds()
          let markerCount = 0

          for (const location of locations) {
            // Only add markers for locations with coordinates
            if (location.latitude && location.longitude) {
              const position = { lat: location.latitude, lng: location.longitude }
              createMarker(mapInstance, position, location)
              bounds.extend(position)
              markerCount++
            }
          }

          // Fit map to show all markers
          if (markerCount > 0) {
            mapInstance.fitBounds(bounds)
            // If only one marker, set a reasonable zoom level
            if (markerCount === 1) {
              mapInstance.setZoom(14)
            }
          } else {
            // If no markers, center on UK
            mapInstance.setCenter({ lat: 54.0, lng: -2.0 })
            mapInstance.setZoom(6)
          }

        if (isMounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to load Google Maps:', error)
        if (isMounted) {
          setMapError('Failed to load map. Please check your Google Maps API key.')
          setLoading(false)
        }
      }
    }

    initMap()

    // Cleanup function
    return () => {
      isMounted = false
    }
  }, [locations, apiKey])

  const createMarker = (
    map: google.maps.Map,
    position: google.maps.LatLng | google.maps.LatLngLiteral,
    location: VehicleLocation
  ) => {
    // Determine color based on vehicle status
    let fillColor = '#10b981' // green-500 (Active)
    let strokeColor = '#059669' // green-600
    
    if (location.vehicles?.off_the_road) {
      fillColor = '#ef4444' // red-500 (VOR)
      strokeColor = '#dc2626' // red-600
    } else if (location.vehicles?.spare_vehicle) {
      fillColor = '#f59e0b' // amber-500 (Spare)
      strokeColor = '#d97706' // amber-600
    }

    // Create custom icon based on vehicle status
    const icon = {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor,
      fillOpacity: 1,
      strokeColor,
      strokeWeight: 2,
      scale: 10,
    }

    const marker = new window.google.maps.Marker({
      position,
      map,
      title: location.vehicles?.vehicle_identifier || location.location_name,
      animation: window.google.maps.Animation.DROP,
      icon,
    })

    // Format last updated date
    const lastUpdated = new Date(location.last_updated).toLocaleString()

    // Determine status badge
    let statusBadge = ''
    if (location.vehicles?.off_the_road) {
      statusBadge = '<span style="display: inline-block; padding: 2px 8px; background-color: #fee2e2; color: #991b1b; border-radius: 9999px; font-size: 11px; font-weight: 600;">VOR</span>'
    } else if (location.vehicles?.spare_vehicle) {
      statusBadge = '<span style="display: inline-block; padding: 2px 8px; background-color: #fef3c7; color: #92400e; border-radius: 9999px; font-size: 11px; font-weight: 600;">Spare</span>'
    } else {
      statusBadge = '<span style="display: inline-block; padding: 2px 8px; background-color: #d1fae5; color: #065f46; border-radius: 9999px; font-size: 11px; font-weight: 600;">Active</span>'
    }

    // Create info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 12px; min-width: 250px;">
          <h3 style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a8a; font-size: 16px;">
            🚗 ${location.vehicles?.vehicle_identifier || 'Unknown Vehicle'}
          </h3>
          <div style="margin-bottom: 8px;">
            ${statusBadge}
          </div>
          ${location.vehicles?.make && location.vehicles?.model ? `
            <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
              <strong>Vehicle:</strong> ${location.vehicles.make} ${location.vehicles.model}
            </p>
          ` : ''}
          ${location.vehicles?.registration ? `
            <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
              <strong>Reg:</strong> ${location.vehicles.registration}
            </p>
          ` : ''}
          <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
            <strong>📍 Location:</strong> ${location.location_name}
          </p>
          ${location.address ? `
            <p style="margin: 4px 0; font-size: 13px; color: #6b7280; line-height: 1.5;">
              ${location.address}
            </p>
          ` : ''}
          <p style="margin: 8px 0 4px 0; font-size: 12px; color: #9ca3af;">
            <strong>Last Updated:</strong><br>${lastUpdated}
          </p>
          <a 
            href="/dashboard/vehicle-locations/${location.id}" 
            style="display: inline-block; margin-top: 12px; padding: 6px 12px; background-color: #1e3a8a; color: white; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 13px;"
          >
            View Details →
          </a>
        </div>
      `,
    })

    marker.addListener('click', () => {
      infoWindow.open(map, marker)
    })
  }

  if (loading) {
    return (
      <div className="h-[600px] rounded-lg border bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy border-t-transparent mx-auto mb-3"></div>
          <p className="text-gray-700">Loading map...</p>
        </div>
      </div>
    )
  }

  if (mapError) {
    return (
      <div className="h-[600px] rounded-lg border bg-red-50 flex items-center justify-center">
        <div className="text-center text-red-800 p-4">
          <p className="font-medium mb-2">⚠️ Map Loading Error</p>
          <p className="text-sm">{mapError}</p>
        </div>
      </div>
    )
  }

  return <div ref={mapRef} className="h-[600px] w-full rounded-lg" />
}

