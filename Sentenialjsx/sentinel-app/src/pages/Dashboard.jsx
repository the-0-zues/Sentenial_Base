import { useRef } from 'react'
import { useUSGS } from '../hooks/useUSGS'
import { useNOAA } from '../hooks/useNOAA'
import { useSafeHavens } from '../hooks/useSafeHavens'
import { usePowerOutages } from '../hooks/usePowerOutages'
import { useRoadClosures } from '../hooks/useRoadClosures'
import { MapPanel } from '../components/MapPanel'
import { EarthquakeList } from '../components/EarthquakeList'
import { TelemetryCards } from '../components/TelemetryCards'

// telemetry prop injected from AppShell so NodeStatusBar & TelemetryCards share one instance
export function Dashboard({ telemetry = {}, storms = [] }) {
  const mapRef = useRef(null)
  const usgs = useUSGS()
  const noaa = useNOAA()
  const { havens } = useSafeHavens()
  const { outages } = usePowerOutages()
  const { closures } = useRoadClosures()

  function handleEventClick(ev) {
    mapRef.current?.flyTo(ev.lng, ev.lat, 9)
  }

  return (
    <div
      className="grid h-full"
      style={{ gridTemplateColumns: '280px 1fr 280px', minHeight: 0 }}
    >
      {/* Left sidebar */}
      <div className="flex flex-col border-r border-[#e2e8f0] bg-white overflow-hidden">
        <EarthquakeList events={usgs.events} onEventClick={handleEventClick} />
      </div>

      {/* Map center */}
      <div className="relative overflow-hidden">
        <MapPanel
          ref={mapRef}
          events={usgs.events}
          havens={havens}
          alerts={noaa.alerts}
          outages={outages}
          closures={closures}
          telemetry={telemetry}
          storms={storms}
        />
      </div>

      {/* Right sidebar */}
      <div className="flex flex-col border-l border-[#e2e8f0] overflow-hidden">
        <TelemetryCards
          telemetry={telemetry}
          usgsStatus={usgs}
          noaaStatus={noaa}
          havens={havens}
        />
      </div>
    </div>
  )
}
