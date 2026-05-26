import { useState, useEffect, useRef } from 'react'

// Swap setInterval for: const ws = new WebSocket('ws://192.168.4.1:8080')
export function useTelemetry() {
  const [data, setData] = useState({
    timestamp: Date.now(),
    amplitude: 72.4,
    hazardDetected: false,
    nodeAlertTime: null,
    usgsConfirmedTime: null,
    deltaT: null,
    crc_ok: true,
  })

  const hazardRef = useRef({ active: false, startTime: null, nodeAlertTime: null })
  const cycleRef = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      cycleRef.current += 1
      const cycle = cycleRef.current
      const hz = hazardRef.current

      // Hazard fires every 300 ticks (30s at 100ms), lasts 80 ticks (8s)
      const CYCLE_PERIOD = 300
      const HAZARD_DURATION = 80
      const posInCycle = cycle % CYCLE_PERIOD

      let hazardDetected = false
      let nodeAlertTime = null
      let usgsConfirmedTime = null
      let deltaT = null
      let amplitude

      if (posInCycle === 1) {
        // Hazard begins
        hz.active = true
        hz.startTime = Date.now()
        hz.nodeAlertTime = Date.now()
        hz.deltaT = 0.3 + Math.random() * 0.9  // 0.3–1.2s ahead of USGS
        hz.usgsDelay = Math.round(hz.deltaT * 10)  // in ticks
      }

      if (posInCycle >= 1 && posInCycle <= HAZARD_DURATION) {
        hazardDetected = true
        nodeAlertTime = hz.nodeAlertTime
        if (posInCycle > hz.usgsDelay) {
          usgsConfirmedTime = hz.nodeAlertTime + Math.round(hz.deltaT * 1000)
          deltaT = hz.deltaT
        }
        // Spike pattern: sharp rise, sustain, decay
        const progress = (posInCycle - 1) / HAZARD_DURATION
        const spike = Math.sin(progress * Math.PI) * (180 + Math.random() * 140)
        amplitude = 60 + spike + (Math.random() - 0.5) * 20
      } else {
        hz.active = false
        // Baseline noise
        amplitude = 55 + Math.random() * 65 + Math.sin(cycle * 0.07) * 12 + (Math.random() - 0.5) * 8
      }

      setData({
        timestamp: Date.now(),
        amplitude: parseFloat(amplitude.toFixed(1)),
        hazardDetected,
        nodeAlertTime,
        usgsConfirmedTime,
        deltaT: deltaT ? parseFloat(deltaT.toFixed(2)) : null,
        crc_ok: Math.random() > 0.002,
      })
    }, 100)

    return () => clearInterval(interval)
  }, [])

  return data
}
