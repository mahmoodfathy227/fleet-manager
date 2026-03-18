// Shared utility for loading Google Maps API (prevents duplicate loads)

declare global {
  interface Window {
    google: typeof google
    googleMapsLoadingPromise?: Promise<void>
  }
}

/**
 * Loads Google Maps API script, preventing duplicate loads
 * @param apiKey - Google Maps API key
 * @param libraries - Optional array of libraries to load (default: ['places'])
 * @returns Promise that resolves when Google Maps is ready
 */
export function loadGoogleMapsScript(
  apiKey: string,
  libraries: string[] = ['places']
): Promise<void> {
  // If already loaded, return resolved promise
  if (window.google && window.google.maps) {
    return Promise.resolve()
  }

  // If already loading, return the existing promise
  if (window.googleMapsLoadingPromise) {
    return window.googleMapsLoadingPromise
  }

  // Check if script tag already exists
  const existingScript = document.querySelector(
    'script[src*="maps.googleapis.com/maps/api/js"]'
  )

  if (existingScript) {
    // Script exists but not loaded yet, wait for it
    window.googleMapsLoadingPromise = new Promise<void>((resolve, reject) => {
      const checkGoogle = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogle)
          resolve()
        }
      }, 100)

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkGoogle)
        reject(new Error('Timeout waiting for Google Maps to load'))
      }, 10000)

      existingScript.addEventListener('error', () => {
        clearInterval(checkGoogle)
        reject(new Error('Failed to load Google Maps'))
      })
    })
    return window.googleMapsLoadingPromise
  }

  // Create new script and load
  const librariesParam = libraries.length > 0 ? `&libraries=${libraries.join(',')}` : ''
  window.googleMapsLoadingPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}${librariesParam}&loading=async&v=weekly`
    script.async = true
    script.defer = true
    script.id = 'google-maps-script'
    
    script.onload = () => {
      // Wait a bit for google to be available
      const checkGoogle = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogle)
          resolve()
        }
      }, 100)

      setTimeout(() => {
        clearInterval(checkGoogle)
        if (window.google && window.google.maps) {
          resolve()
        } else {
          window.googleMapsLoadingPromise = undefined
          reject(new Error('Google Maps API loaded but not available'))
        }
      }, 5000)
    }
    
    script.onerror = () => {
      window.googleMapsLoadingPromise = undefined
      reject(new Error('Failed to load Google Maps'))
    }
    
    document.head.appendChild(script)
  })

  return window.googleMapsLoadingPromise
}

