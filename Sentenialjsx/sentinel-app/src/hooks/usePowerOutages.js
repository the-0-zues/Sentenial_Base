import { useState } from 'react'

// SIMULATED — live integration via ODIN (Oak Ridge National Laboratory)
// ornl.opendatasoft.com/explore/dataset/odin-real-time-outages-county/api/
// Labeled "simulated" in About page

const MOCK_OUTAGES = [
  {
    county: 'New York',
    state: 'NY',
    lat: 40.7128,
    lng: -74.006,
    customersOut: 12400,
    totalCustomers: 847000,
  },
  {
    county: 'Nassau',
    state: 'NY',
    lat: 40.6547,
    lng: -73.5594,
    customersOut: 3200,
    totalCustomers: 456000,
  },
  {
    county: 'Suffolk',
    state: 'NY',
    lat: 40.8816,
    lng: -73.0379,
    customersOut: 8700,
    totalCustomers: 589000,
  },
  {
    county: 'Queens',
    state: 'NY',
    lat: 40.7282,
    lng: -73.7949,
    customersOut: 1500,
    totalCustomers: 782000,
  },
  {
    county: 'Westchester',
    state: 'NY',
    lat: 41.1220,
    lng: -73.7949,
    customersOut: 920,
    totalCustomers: 367000,
  },
]

export function usePowerOutages() {
  const [outages] = useState(MOCK_OUTAGES)
  return { outages, simulated: true }
}
