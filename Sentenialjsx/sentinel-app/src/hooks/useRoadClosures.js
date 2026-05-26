import { useState } from 'react'

// SIMULATED — live integration via OpenWeb Ninja Traffic API (free tier)
// Labeled "simulated" in About page

const MOCK_CLOSURES = [
  {
    id: 'rc-1',
    lat: 40.748,
    lng: -73.985,
    description: 'I-495 Eastbound — Accident clearance',
    severity: 'major',
    street: 'I-495 Long Island Expressway',
  },
  {
    id: 'rc-2',
    lat: 40.712,
    lng: -74.013,
    description: 'Holland Tunnel approach — Structural inspection',
    severity: 'moderate',
    street: 'Canal St',
  },
  {
    id: 'rc-3',
    lat: 40.758,
    lng: -73.969,
    description: 'FDR Drive NB — Emergency road repair',
    severity: 'minor',
    street: 'FDR Drive',
  },
]

export function useRoadClosures() {
  const [closures] = useState(MOCK_CLOSURES)
  return { closures, simulated: true }
}
