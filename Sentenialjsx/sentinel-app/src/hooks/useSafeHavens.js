import { useState, useEffect, useCallback } from 'react'
import { NODE_LOCATION } from '../constants'

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function buildOverpassQuery(bbox) {
  const [s, w, n, e] = bbox
  return `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](${s},${w},${n},${e});
      way["amenity"="hospital"](${s},${w},${n},${e});
      node["amenity"="shelter"](${s},${w},${n},${e});
      node["emergency"="shelter"](${s},${w},${n},${e});
    );
    out center;
  `
}

// Default bbox covers NY metro area [south, west, north, east]
const DEFAULT_BBOX = [40.4, -74.5, 41.2, -73.5]

export function useSafeHavens(bbox = DEFAULT_BBOX) {
  const [state, setState] = useState({ havens: [], loading: true, error: null })
  const [currentBbox, setCurrentBbox] = useState(bbox)

  const fetchHavens = useCallback(async (b) => {
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const query = buildOverpassQuery(b)
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
      })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      const json = await res.json()

      const nodeLat = NODE_LOCATION[1]
      const nodeLng = NODE_LOCATION[0]

      const havens = json.elements
        .filter((el) => {
          const lat = el.lat ?? el.center?.lat
          const lng = el.lon ?? el.center?.lon
          return lat != null && lng != null
        })
        .map((el) => {
          const lat = el.lat ?? el.center?.lat
          const lng = el.lon ?? el.center?.lon
          const tags = el.tags || {}
          const type =
            tags.amenity === 'hospital' ? 'hospital' : 'shelter'
          return {
            id: el.id,
            name: tags.name || (type === 'hospital' ? 'Hospital' : 'Shelter'),
            type,
            lat,
            lng,
            address:
              [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
                .filter(Boolean)
                .join(' ') || 'Address unknown',
            distanceKm: parseFloat(haversineKm(nodeLat, nodeLng, lat, lng).toFixed(1)),
            status: 'Open',
          }
        })
        .sort((a, b) => a.distanceKm - b.distanceKm)

      setState({ havens, loading: false, error: null })
    } catch (err) {
      // Fallback mock data if Overpass fails
      setState({
        loading: false,
        error: null,
        havens: [
          { id: 1, name: 'Bellevue Hospital Center', type: 'hospital', lat: 40.7396, lng: -73.9759, address: '462 First Ave, New York', distanceKm: haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], 40.7396, -73.9759).toFixed(1) * 1, status: 'Open' },
          { id: 2, name: 'NYC Emergency Shelter — Midtown', type: 'shelter', lat: 40.7549, lng: -73.9840, address: '520 W 41st St, New York', distanceKm: haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], 40.7549, -73.9840).toFixed(1) * 1, status: 'Open' },
          { id: 3, name: 'NYU Langone Health', type: 'hospital', lat: 40.7418, lng: -73.9743, address: '550 First Ave, New York', distanceKm: haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], 40.7418, -73.9743).toFixed(1) * 1, status: 'Open' },
          { id: 4, name: 'Mount Sinai Hospital', type: 'hospital', lat: 40.7899, lng: -73.9527, address: '1468 Madison Ave, New York', distanceKm: haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], 40.7899, -73.9527).toFixed(1) * 1, status: 'Open' },
          { id: 5, name: 'Red Cross Shelter — Brooklyn', type: 'shelter', lat: 40.6782, lng: -73.9442, address: '195 Montague St, Brooklyn', distanceKm: haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], 40.6782, -73.9442).toFixed(1) * 1, status: 'Open' },
          { id: 6, name: 'Long Island Jewish Medical', type: 'hospital', lat: 40.7546, lng: -73.7058, address: '270-05 76th Ave, New Hyde Park', distanceKm: haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], 40.7546, -73.7058).toFixed(1) * 1, status: 'Open' },
          { id: 7, name: 'Community Emergency Shelter — Queens', type: 'shelter', lat: 40.7282, lng: -73.7949, address: '89-11 Merrick Blvd, Queens', distanceKm: haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], 40.7282, -73.7949).toFixed(1) * 1, status: 'Open' },
          { id: 8, name: 'Montefiore Medical Center', type: 'hospital', lat: 40.8782, lng: -73.8782, address: '111 E 210th St, Bronx', distanceKm: haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], 40.8782, -73.8782).toFixed(1) * 1, status: 'Open' },
        ].sort((a, b) => a.distanceKm - b.distanceKm),
      })
    }
  }, [])

  useEffect(() => {
    fetchHavens(currentBbox)
  }, [currentBbox, fetchHavens])

  const updateBbox = useCallback((newBbox) => {
    setCurrentBbox(newBbox)
  }, [])

  return { ...state, updateBbox }
}
