'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsScript } from '@/lib/google-maps-loader'

interface School {
  id: number
  name: string
  address: string | null
  latitude?: number | null
  longitude?: number | null
  created_at?: string
  updated_at?: string
}

interface SchoolsMapProps {
  schools: School[]
  apiKey: string
}

// Extend Window interface to include google
declare global {
  interface Window {
    google: typeof google
  }
}

export function SchoolsMap({ schools, apiKey }: SchoolsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Ensure component only renders on client
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Don't initialize until component is mounted on client
    if (!mounted) return

    let isMounted = true

    const initMap = async () => {
      try {
        // Load Google Maps API (will prevent duplicates)
        await loadGoogleMapsScript(apiKey, ['places', 'geocoding'])

        // Google Maps API is now available globally
        if (!mapRef.current || !window.google || !window.google.maps) {
          if (isMounted) {
            setError('Google Maps API failed to initialize')
            setLoading(false)
          }
          return
        }

        // Default center (UK)
        const defaultCenter = { lat: 54.5, lng: -2.0 }

        const mapInstance = new window.google.maps.Map(mapRef.current, {
          center: defaultCenter,
          zoom: 6,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        })

        setMap(mapInstance)

        // Geocode schools and add markers
        const geocoder = new window.google.maps.Geocoder()
        const bounds = new window.google.maps.LatLngBounds()
        let markerCount = 0

        for (const school of schools) {
          // Skip schools without addresses
          if (!school.address) {
            console.warn(`School ${school.name} has no address, skipping`)
            continue
          }

          // If school already has coordinates, use them
          if (school.latitude && school.longitude) {
            const position = { lat: school.latitude, lng: school.longitude }
            createMarker(mapInstance, position, school)
            bounds.extend(position)
            markerCount++
          } else {
            // Otherwise, geocode the address
            const fullAddress = school.address
            
            try {
              const result = await geocoder.geocode({ address: fullAddress })
              
              if (result.results[0]) {
                const position = result.results[0].geometry.location
                createMarker(mapInstance, position, school)
                bounds.extend(position)
                markerCount++
              }
            } catch (err) {
              console.error(`Failed to geocode ${school.name}:`, err)
            }
          }
        }

        // Fit map to show all markers
        if (markerCount > 0) {
          mapInstance.fitBounds(bounds)
          
          // Don't zoom in too much if only one marker
          window.google.maps.event.addListenerOnce(mapInstance, 'bounds_changed', () => {
            const zoom = mapInstance.getZoom()
            if (zoom && zoom > 15) {
              mapInstance.setZoom(15)
            }
          })
        }

        if (isMounted) {
          setLoading(false)
        }
      } catch (err) {
        console.error('Error initializing map:', err)
        if (isMounted) {
          setError('Failed to load map. Please check your Google Maps API key.')
          setLoading(false)
        }
      }
    }

    initMap()

    // Cleanup function
    return () => {
      isMounted = false
    }
  }, [schools, apiKey, mounted])

  // Don't render until mounted on client
  if (!mounted) {
    return (
      <div className="h-[500px] rounded-lg border bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }

  const createMarker = (
    map: google.maps.Map,
    position: google.maps.LatLng | google.maps.LatLngLiteral,
    school: School
  ) => {
    const marker = new window.google.maps.Marker({
      position,
      map,
      title: school.name,
      animation: window.google.maps.Animation.DROP,
    })

    // Create info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div style="padding: 12px; min-width: 220px;">
          <h3 style="margin: 0 0 10px 0; font-weight: bold; color: #1e3a8a; font-size: 16px;">
            ${school.name}
          </h3>
          ${school.address ? `
            <p style="margin: 4px 0; font-size: 13px; color: #4b5563; line-height: 1.5;">
              📍 ${school.address}
            </p>
          ` : ''}
          <a 
            href="/dashboard/schools/${school.id}" 
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
      <div className="h-[500px] rounded-lg border bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[500px] rounded-lg border bg-red-50 flex items-center justify-center">
        <div className="text-center text-red-700 p-4">
          <p className="font-medium mb-2">⚠️ Map Loading Error</p>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-2">Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={mapRef} 
      className="h-[500px] w-full rounded-lg border shadow-md"
      style={{ minHeight: '500px' }}
    />
  )
}

