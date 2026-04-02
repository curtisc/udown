'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  defaultPlaceName?: string | null
  defaultPlaceAddress?: string | null
}

// Prevent loading the Google Maps script multiple times
let googleScriptState: 'idle' | 'loading' | 'loaded' = 'idle'
const onLoadCallbacks: (() => void)[] = []

function loadGoogleMaps(apiKey: string, callback: () => void) {
  if (googleScriptState === 'loaded') {
    callback()
    return
  }
  onLoadCallbacks.push(callback)
  if (googleScriptState === 'loading') return

  googleScriptState = 'loading'
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
  script.async = true
  script.onload = () => {
    googleScriptState = 'loaded'
    onLoadCallbacks.forEach((cb) => cb())
    onLoadCallbacks.length = 0
  }
  document.head.appendChild(script)
}

export function PlacesAutocomplete({ defaultPlaceName, defaultPlaceAddress }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [placeName, setPlaceName] = useState(defaultPlaceName || '')
  const [placeAddress, setPlaceAddress] = useState(defaultPlaceAddress || '')
  const [placeLat, setPlaceLat] = useState<number | null>(null)
  const [placeLng, setPlaceLng] = useState<number | null>(null)
  const [placeId, setPlaceId] = useState<string | null>(null)

  // Load Google Maps API
  useEffect(() => {
    if (!apiKey) return
    loadGoogleMaps(apiKey, () => setReady(true))
  }, [apiKey])

  // Create PlaceAutocompleteElement once ready
  useEffect(() => {
    if (!ready || !containerRef.current) return
    if (typeof google === 'undefined' || !google?.maps?.places?.PlaceAutocompleteElement) return

    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild)
    }

    const el = new google.maps.places.PlaceAutocompleteElement({})
    el.style.width = '100%'

    el.addEventListener('gmp-select', async (event: unknown) => {
      const { placePrediction } = event as { placePrediction: google.maps.places.PlacePrediction }
      const place = placePrediction.toPlace()
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      })

      const name = place.displayName || ''
      const address = place.formattedAddress || ''

      setPlaceName(name)
      setPlaceAddress(address)
      setPlaceLat(place.location?.lat() ?? null)
      setPlaceLng(place.location?.lng() ?? null)
      setPlaceId(place.id || null)
    })

    containerRef.current.appendChild(el)
  }, [ready])

  const inputClasses =
    'mt-1 w-full rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--brand-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-accent)]'

  // Show address only when the place name is NOT already an address
  // (i.e., when it's a named venue like "Victory Point Cafe", show the street address below)
  // If the user searched for an address directly, the name and address are nearly identical — skip
  const showAddress = placeAddress && placeName &&
    !placeAddress.toLowerCase().startsWith(placeName.toLowerCase().slice(0, 10))

  // No API key — plain text inputs
  if (!apiKey) {
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)]">Where? *</label>
          <input
            type="text"
            required
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder="Dolores Park, My apartment, etc."
            className={inputClasses}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)]">Address</label>
          <input
            type="text"
            value={placeAddress}
            onChange={(e) => setPlaceAddress(e.target.value)}
            placeholder="123 Main St"
            className={inputClasses}
          />
        </div>
        <input type="hidden" name="placeName" value={placeName} />
        <input type="hidden" name="placeAddress" value={placeAddress} />
        <input type="hidden" name="placeLat" value={placeLat ?? ''} />
        <input type="hidden" name="placeLng" value={placeLng ?? ''} />
        <input type="hidden" name="placeId" value={placeId ?? ''} />
      </div>
    )
  }

  // API key set — Google autocomplete (or loading state)
  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)]">Where? *</label>
        {ready ? (
          <div ref={containerRef} className="mt-1" />
        ) : (
          <div className="mt-1 h-10 rounded-lg border border-[var(--bg-surface)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            Loading places...
          </div>
        )}
      </div>
      <input type="hidden" name="placeName" value={placeName} />
      <input type="hidden" name="placeAddress" value={placeAddress} />
      <input type="hidden" name="placeLat" value={placeLat ?? ''} />
      <input type="hidden" name="placeLng" value={placeLng ?? ''} />
      <input type="hidden" name="placeId" value={placeId ?? ''} />
    </div>
  )
}
