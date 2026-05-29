import { useState, useEffect } from 'react'

const NHC_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json'

function parseLng(longitudeNumeric, longitudeStr) {
  const abs = Math.abs(longitudeNumeric ?? parseFloat(longitudeStr))
  const isWest = typeof longitudeStr === 'string' && longitudeStr.toUpperCase().includes('W')
  return isWest ? -abs : abs
}

async function fetchCone(stormId) {
  try {
    const id = stormId.toUpperCase()
    const res = await fetch(
      `https://www.nhc.noaa.gov/storm_graphics/api/${id}_5day_pgn.json`
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export function useNHC() {
  const [state, setState] = useState({ storms: [], loading: true, error: null })

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(NHC_URL)
        if (!res.ok) throw new Error(`NHC ${res.status}`)
        const json = await res.json()

        const active = json.activeStorms ?? []

        const storms = await Promise.all(
          active.map(async (s) => {
            const cone = await fetchCone(s.id)
            return {
              id: s.id,
              name: s.name,
              classification: s.classification,
              lat: s.latitudeNumeric ?? parseFloat(s.latitude),
              lng: parseLng(s.longitudeNumeric, s.longitude),
              intensity: parseInt(s.intensity) || 0,
              pressure: parseInt(s.pressure) || null,
              movementDir: s.movementDir,
              movementSpeed: s.movementSpeed,
              lastUpdate: s.lastUpdate,
              cone,
            }
          })
        )

        setState({ storms, loading: false, error: null })
      } catch (err) {
        // Fail silently — no active storms or CORS block
        setState({ storms: [], loading: false, error: err.message })
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 15 * 60_000)
    return () => clearInterval(interval)
  }, [])

  return state
}
