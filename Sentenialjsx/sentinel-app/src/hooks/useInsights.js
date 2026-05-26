import { useState, useEffect } from 'react'

export function useInsights({ telemetry, usgsEvents, safeHavens, roadClosures }) {
  const [insight, setInsight] = useState({ message: '', isHazard: false })

  useEffect(() => {
    function buildMessage() {
      const { hazardDetected, deltaT } = telemetry

      if (hazardDetected) {
        const topEvent = usgsEvents[0]
        const mag = topEvent ? topEvent.magnitude.toFixed(1) : '??'
        const place = topEvent ? topEvent.place : 'unknown location'
        const closedCount = roadClosures.length
        const firstHaven = safeHavens[0]?.name ?? 'no haven'
        const dtStr = deltaT != null ? `${deltaT}s` : '~0.8s'
        return {
          message: `⚠ M${mag} detected near ${place} · ${closedCount} road${closedCount !== 1 ? 's' : ''} closed · ${firstHaven} open · NODE-01 detected ${dtStr} pre-USGS`,
          isHazard: true,
        }
      }

      const havenCount = safeHavens.length
      return {
        message: `✓ All systems nominal · No seismic activity detected · ${havenCount} safe havens active`,
        isHazard: false,
      }
    }

    setInsight(buildMessage())
    const interval = setInterval(() => setInsight(buildMessage()), 5000)
    return () => clearInterval(interval)
  }, [telemetry, usgsEvents, safeHavens, roadClosures])

  return insight
}
