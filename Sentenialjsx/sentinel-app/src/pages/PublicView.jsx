import { useRef, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useNOAA } from '../hooks/useNOAA'
import { useRoadClosures } from '../hooks/useRoadClosures'
import { useSafeHavens } from '../hooks/useSafeHavens'
import { MapPanel } from '../components/MapPanel'

const SEVERITY_COLOR = {
  Extreme: '#dc2626',
  Severe: '#f97316',
  Moderate: '#d97706',
  Minor: '#16a34a',
}

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

function AlertItem({ alert }) {
  const p = alert.properties ?? {}
  const color = SEVERITY_COLOR[p.severity] ?? '#64748b'
  return (
    <div className="border-b border-[#f1f5f9] px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 w-1.5 h-1.5 mt-1.5" style={{ background: color }} />
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#0f172a] leading-tight" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            {p.event}
          </p>
          <p className="text-[11px] text-[#334155] mt-0.5 leading-snug" style={{ fontFamily: 'Inter, sans-serif' }}>
            {p.headline}
          </p>
        </div>
      </div>
    </div>
  )
}

function ClosureItem({ closure }) {
  const sevColor = { major: '#dc2626', moderate: '#f97316', minor: '#d97706' }[closure.severity] ?? '#64748b'
  return (
    <div className="border-b border-[#f1f5f9] px-4 py-3">
      <p className="text-[11px] font-bold text-[#0f172a] leading-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
        {closure.street}
      </p>
      <p className="text-[10px] text-[#64748b] mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
        {closure.description}
      </p>
      <span
        className="inline-block mt-1 text-[9px] font-bold uppercase px-1.5 py-0.5"
        style={{ background: sevColor + '18', color: sevColor, fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {closure.severity}
      </span>
    </div>
  )
}

function SideLabel({ children }) {
  return (
    <p
      className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] border-b border-[#e2e8f0] bg-[#f8fafc]"
      style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.14em' }}
    >
      {children}
    </p>
  )
}

export function PublicView({ storms = [] }) {
  const mapRef = useRef(null)
  const noaa = useNOAA()
  const { closures } = useRoadClosures()
  const { havens, loading: havensLoading } = useSafeHavens()

  const [userPin, setUserPin] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState(null)

  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('GPS not supported by your browser')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserPin({ lat, lng })
        setGeoLoading(false)
        mapRef.current?.flyTo(lng, lat, 13)
      },
      () => {
        setGeoError('Location access denied')
        setGeoLoading(false)
      },
      { timeout: 10000 }
    )
  }, [])

  const handleBaseClick = useCallback((lat, lng) => {
    setUserPin({ lat, lng })
  }, [])

  const sortedHavens = useMemo(() => {
    if (!userPin) return [...havens].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5)
    return [...havens]
      .map((h) => ({ ...h, distFromUser: parseFloat(haversineKm(userPin.lat, userPin.lng, h.lat, h.lng).toFixed(1)) }))
      .sort((a, b) => a.distFromUser - b.distFromUser)
      .slice(0, 5)
  }, [havens, userPin])

  const activeAlerts = noaa.alerts.filter(
    (f) => f.geometry && ['Polygon', 'MultiPolygon'].includes(f.geometry?.type)
  )
  const activeStorms = storms.filter((s) => s.intensity >= 34)

  return (
    <div
      className="grid h-full"
      style={{ gridTemplateColumns: '280px 1fr 280px', minHeight: 0 }}
    >
      {/* Left — weather + road */}
      <div className="flex flex-col border-r border-[#e2e8f0] bg-white overflow-hidden">
        <SideLabel>WEATHER ALERTS</SideLabel>
        <div className="flex-1 overflow-y-auto">
          {noaa.loading ? (
            <p className="px-4 py-4 text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>LOADING…</p>
          ) : activeAlerts.length === 0 ? (
            <div className="px-4 py-4 flex items-center gap-2">
              <span className="w-2 h-2 flex-shrink-0" style={{ background: '#16a34a' }} />
              <p className="text-[12px] text-[#334155]" style={{ fontFamily: 'Inter, sans-serif' }}>No active weather alerts</p>
            </div>
          ) : (
            noaa.alerts.map((a, i) => <AlertItem key={i} alert={a} />)
          )}
        </div>

        <SideLabel>ROAD CLOSURES</SideLabel>
        <div className="flex-1 overflow-y-auto">
          {closures.length === 0 ? (
            <div className="px-4 py-4 flex items-center gap-2">
              <span className="w-2 h-2 flex-shrink-0" style={{ background: '#16a34a' }} />
              <p className="text-[12px] text-[#334155]" style={{ fontFamily: 'Inter, sans-serif' }}>No active road closures</p>
            </div>
          ) : (
            closures.map((c) => <ClosureItem key={c.id} closure={c} />)
          )}
        </div>
      </div>

      {/* Map */}
      <div className="relative overflow-hidden">
        <MapPanel
          ref={mapRef}
          events={[]}
          havens={havens}
          alerts={noaa.alerts}
          outages={[]}
          closures={closures}
          telemetry={{}}
          storms={storms}
          mode="public"
          userPin={userPin}
          onBaseClick={handleBaseClick}
        />
        {/* Map hint */}
        {!userPin && (
          <div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-none px-3 py-1.5 text-[10px] font-bold text-white"
            style={{ background: 'rgba(15,23,42,0.65)', fontFamily: "'IBM Plex Mono', monospace', backdropFilter: 'blur(4px)" }}
          >
            CLICK MAP TO DROP YOUR PIN
          </div>
        )}
      </div>

      {/* Right — shelter finder */}
      <div className="flex flex-col border-l border-[#e2e8f0] bg-white overflow-hidden">
        {activeStorms.length > 0 && (
          <div className="flex-shrink-0 bg-purple-50 border-b border-purple-200 px-4 py-3">
            <p className="text-[10px] font-bold text-purple-700" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              🌀 {activeStorms.length} ACTIVE STORM{activeStorms.length > 1 ? 'S' : ''}
            </p>
            {activeStorms.map((s) => (
              <p key={s.id} className="text-[11px] text-purple-900 mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                {s.classification} {s.name} — {s.intensity} mph
              </p>
            ))}
          </div>
        )}

        {/* Location controls */}
        <div className="flex-shrink-0 border-b border-[#e2e8f0] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2"
            style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.14em' }}>
            YOUR LOCATION
          </p>
          <button
            onClick={handleUseLocation}
            disabled={geoLoading}
            className="w-full py-2 text-[10px] font-bold uppercase tracking-wide border border-[#2563eb] text-[#2563eb] hover:bg-[#eff6ff] transition-colors cursor-pointer disabled:opacity-50"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {geoLoading ? 'LOCATING…' : '⊕ USE MY GPS LOCATION'}
          </button>
          {geoError && (
            <p className="text-[10px] text-[#dc2626] mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>{geoError}</p>
          )}
          {userPin && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-[#16a34a] font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                ● PIN PLACED
              </p>
              <button
                onClick={() => setUserPin(null)}
                className="text-[10px] text-[#94a3b8] hover:text-[#dc2626] cursor-pointer underline"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                CLEAR
              </button>
            </div>
          )}
          {!userPin && !geoLoading && (
            <p className="text-[10px] text-[#94a3b8] mt-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
              Or click anywhere on the map
            </p>
          )}
        </div>

        <SideLabel>
          {userPin ? 'NEAREST SHELTERS TO YOU' : 'FIND NEAREST SHELTER'}
        </SideLabel>

        <div className="flex-1 overflow-y-auto">
          {havensLoading ? (
            <p className="px-4 py-4 text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              LOCATING FACILITIES…
            </p>
          ) : sortedHavens.length === 0 ? (
            <p className="px-4 py-4 text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              No facilities found.
            </p>
          ) : (
            sortedHavens.map((h) => {
              const dist = userPin ? h.distFromUser : h.distanceKm
              const distLabel = userPin ? `${dist} km from you` : `${dist} km away`
              return (
                <div key={h.id} className="border-b border-[#f1f5f9] px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0 mt-0.5">{h.type === 'hospital' ? '🏥' : '🏠'}</span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#0f172a] leading-snug" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {h.name}
                      </p>
                      <p className="text-[10px] text-[#64748b] mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {h.address}
                      </p>
                      <p className="text-[10px] font-bold text-[#2563eb] mt-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {distLabel} · {h.status}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex-shrink-0 border-t border-[#e2e8f0] px-4 py-3">
          <Link
            to="/safe-havens"
            className="flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-white no-underline"
            style={{ background: '#2563eb', fontFamily: "'IBM Plex Mono', monospace" }}
          >
            VIEW ALL FACILITIES →
          </Link>
        </div>
      </div>
    </div>
  )
}
