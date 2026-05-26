import { useState, useEffect } from 'react'

const NOAA_URL = 'https://api.weather.gov/alerts/active?area=NY,NJ,CT,PA'

export function useNOAA() {
  const [state, setState] = useState({ alerts: [], loading: true, error: null, lastFetch: null })

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(NOAA_URL, {
          headers: { Accept: 'application/geo+json' },
        })
        if (!res.ok) throw new Error(`NOAA ${res.status}`)
        const json = await res.json()
        setState({
          alerts: json.features || [],
          loading: false,
          error: null,
          lastFetch: Date.now(),
        })
      } catch (err) {
        setState((prev) => ({ ...prev, loading: false, error: err.message }))
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 300_000)
    return () => clearInterval(interval)
  }, [])

  return state
}
