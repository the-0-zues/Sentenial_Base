import { useState, useEffect } from 'react'

const USGS_URL =
  'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=1&limit=100&orderby=time'

export function useUSGS() {
  const [state, setState] = useState({ events: [], loading: true, error: null, lastFetch: null })

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(USGS_URL)
        if (!res.ok) throw new Error(`USGS ${res.status}`)
        const json = await res.json()
        const events = json.features.map((f) => ({
          id: f.id,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          depth: f.geometry.coordinates[2],
          magnitude: f.properties.mag,
          place: f.properties.place,
          time: f.properties.time,
          url: f.properties.url,
        }))
        setState({ events, loading: false, error: null, lastFetch: Date.now() })
      } catch (err) {
        setState((prev) => ({ ...prev, loading: false, error: err.message }))
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [])

  return state
}
