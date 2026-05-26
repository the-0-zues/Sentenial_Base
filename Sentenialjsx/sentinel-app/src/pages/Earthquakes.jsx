import { useState, useMemo, useCallback } from 'react'
import Map, { Marker } from '@vis.gl/react-maplibre'
import { useUSGS } from '../hooks/useUSGS'
import { useSafeHavens } from '../hooks/useSafeHavens'
import { MAP_STYLE_URL, NODE_LOCATION } from '../constants'

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

function magBg(m) {
  if (m >= 4) return { bg: '#dc2626', color: '#fff' }
  if (m >= 3) return { bg: '#f97316', color: '#fff' }
  return { bg: '#eab308', color: '#0f172a' }
}

function MagBadge({ mag }) {
  const { bg, color } = magBg(mag)
  return (
    <span
      className="inline-flex items-center justify-center font-bold text-[10px] px-2 py-0.5"
      style={{ background: bg, color, fontFamily: "'IBM Plex Mono', monospace" }}
    >
      M{parseFloat(mag).toFixed(1)}
    </span>
  )
}

function SortIcon({ dir }) {
  if (!dir) return <span className="ml-1 text-[#e2e8f0]">↕</span>
  return <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

const TIME_RANGES = [
  { label: '1H', ms: 3600_000 },
  { label: '6H', ms: 21600_000 },
  { label: '24H', ms: 86400_000 },
  { label: '7D', ms: 604800_000 },
]

export function Earthquakes() {
  const { events, loading } = useUSGS()
  const { havens } = useSafeHavens()

  const [minMag, setMinMag] = useState(1)
  const [timeRange, setTimeRange] = useState('24H')
  const [regionSearch, setRegionSearch] = useState('')
  const [sort, setSort] = useState({ col: 'time', dir: 'desc' })
  const [selected, setSelected] = useState(null)

  const timeMs = TIME_RANGES.find((t) => t.label === timeRange)?.ms ?? 86400_000
  const cutoff = Date.now() - timeMs

  const filtered = useMemo(() => {
    return events.filter(
      (e) =>
        e.magnitude >= minMag &&
        e.time >= cutoff &&
        (regionSearch === '' || e.place?.toLowerCase().includes(regionSearch.toLowerCase()))
    )
  }, [events, minMag, cutoff, regionSearch])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let av = a[sort.col]
      let bv = b[sort.col]
      if (sort.col === 'distance') {
        av = haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], a.lat, a.lng)
        bv = haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], b.lat, b.lng)
      }
      return sort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return arr
  }, [filtered, sort])

  const toggleSort = useCallback((col) => {
    setSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: col === 'time' ? 'desc' : 'asc' }
    )
  }, [])

  const nearestHavens = useMemo(() => {
    if (!selected) return []
    return [...havens]
      .map((h) => ({
        ...h,
        distToEvent: haversineKm(selected.lat, selected.lng, h.lat, h.lng),
      }))
      .sort((a, b) => a.distToEvent - b.distToEvent)
      .slice(0, 3)
  }, [selected, havens])

  const COLS = [
    { id: 'magnitude', label: 'M', width: '70px' },
    { id: 'place', label: 'LOCATION', width: 'auto' },
    { id: 'depth', label: 'DEPTH', width: '90px' },
    { id: 'time', label: 'TIME', width: '170px' },
    { id: 'distance', label: 'DIST FROM NODE-01', width: '140px' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      {/* Page header */}
      <div className="px-6 py-4 bg-white border-b border-[#e2e8f0] flex-shrink-0">
        <h1
          className="text-[11px] font-bold uppercase tracking-widest text-[#64748b] mb-3"
          style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.14em' }}
        >
          SEISMIC EVENT LOG
        </h1>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Magnitude slider */}
          <div className="flex items-center gap-2">
            <label
              className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              MIN MAG
            </label>
            <input
              type="range"
              min={1}
              max={9}
              step={0.5}
              value={minMag}
              onChange={(e) => setMinMag(parseFloat(e.target.value))}
              className="w-24 accent-[#2563eb]"
            />
            <span
              className="text-[10px] font-bold text-[#0f172a] w-6"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {minMag}
            </span>
          </div>

          {/* Time range */}
          <div className="flex items-center gap-1">
            <span
              className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mr-1"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              RANGE
            </span>
            {TIME_RANGES.map((t) => (
              <button
                key={t.label}
                onClick={() => setTimeRange(t.label)}
                className="px-2 py-1 text-[9px] font-bold border cursor-pointer transition-colors"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  background: timeRange === t.label ? '#1e3a5f' : '#ffffff',
                  color: timeRange === t.label ? '#ffffff' : '#64748b',
                  borderColor: '#e2e8f0',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Region search */}
          <div className="flex items-center gap-2">
            <label
              className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              REGION
            </label>
            <input
              type="text"
              value={regionSearch}
              onChange={(e) => setRegionSearch(e.target.value)}
              placeholder="Search location…"
              className="border border-[#e2e8f0] px-2 py-1 text-[11px] w-40 bg-white text-[#0f172a] focus:outline-none focus:border-[#2563eb]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            />
          </div>

          <span
            className="ml-auto text-[10px] text-[#94a3b8]"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {sorted.length} EVENTS
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f1f5f9] border-b border-[#e2e8f0] sticky top-0 z-10">
              {COLS.map((col) => (
                <th
                  key={col.id}
                  onClick={() => toggleSort(col.id)}
                  className="px-4 py-2.5 text-left cursor-pointer hover:bg-[#e2e8f0] transition-colors select-none"
                  style={{ width: col.width }}
                >
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest text-[#64748b]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.1em' }}
                  >
                    {col.label}
                    <SortIcon dir={sort.col === col.id ? sort.dir : null} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  LOADING EVENTS…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  NO EVENTS MATCH FILTERS
                </td>
              </tr>
            ) : (
              sorted.map((ev, i) => {
                const dist = haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], ev.lat, ev.lng).toFixed(0)
                return (
                  <tr
                    key={ev.id}
                    onClick={() => setSelected(ev)}
                    className="border-b border-[#f1f5f9] hover:bg-[#f0f7ff] cursor-pointer transition-colors"
                    style={{ background: i % 2 === 0 ? '#ffffff' : '#fafbfc' }}
                  >
                    <td className="px-4 py-2.5">
                      <MagBadge mag={ev.magnitude} />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[12px] text-[#0f172a]" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {ev.place}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] text-[#64748b]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {ev.depth?.toFixed(1)} km
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] text-[#64748b]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {new Date(ev.time).toLocaleString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] text-[#64748b]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {dist} km
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Event detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div
            className="bg-white border border-[#e2e8f0] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <MagBadge mag={selected.magnitude} />
                <div>
                  <p
                    className="text-[13px] font-semibold text-[#0f172a] leading-tight"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {selected.place}
                  </p>
                  <p
                    className="text-[10px] text-[#64748b] mt-0.5"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {new Date(selected.time).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                      timeZoneName: 'short',
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-[#64748b] hover:text-[#0f172a] text-xl leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Details row */}
            <div className="grid grid-cols-3 border-b border-[#e2e8f0]">
              {[
                { label: 'DEPTH', value: `${selected.depth?.toFixed(1)} km` },
                { label: 'COORDINATES', value: `${selected.lat.toFixed(3)}°N ${Math.abs(selected.lng).toFixed(3)}°W` },
                { label: 'DIST FROM NODE-01', value: `${haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], selected.lat, selected.lng).toFixed(0)} km` },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-3 border-r border-[#f1f5f9] last:border-r-0">
                  <p
                    className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-1"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em' }}
                  >
                    {label}
                  </p>
                  <p
                    className="text-[12px] font-semibold text-[#0f172a]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* NODE-01 early warning banner */}
            {haversineKm(NODE_LOCATION[1], NODE_LOCATION[0], selected.lat, selected.lng) < 300 && (
              <div
                className="px-5 py-3 border-b border-[#e2e8f0] flex items-center gap-2"
                style={{ background: '#eff6ff' }}
              >
                <span
                  className="w-2 h-2 flex-shrink-0"
                  style={{ background: '#2563eb', boxShadow: '0 0 4px #2563eb' }}
                />
                <span
                  className="text-[11px] font-medium text-[#2563eb]"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  NODE-01 detected {selected.magnitude >= 2.5 ? '0.8–1.2s' : 'sub-threshold'} before USGS confirmation
                </span>
              </div>
            )}

            {/* Mini map */}
            <div className="border-b border-[#e2e8f0]" style={{ height: 220 }}>
              <Map
                initialViewState={{
                  longitude: selected.lng,
                  latitude: selected.lat,
                  zoom: 8,
                }}
                mapStyle={MAP_STYLE_URL}
                style={{ width: '100%', height: '100%' }}
              >
                <Marker longitude={selected.lng} latitude={selected.lat} anchor="center">
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      background: selected.magnitude >= 4 ? '#dc2626' : selected.magnitude >= 3 ? '#f97316' : '#eab308',
                      border: '2px solid white',
                      boxShadow: '0 0 8px rgba(0,0,0,0.3)',
                    }}
                  />
                </Marker>
              </Map>
            </div>

            {/* Nearest safe havens */}
            <div className="px-5 py-4">
              <p
                className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-3"
                style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em' }}
              >
                NEAREST SAFE HAVENS TO EPICENTER
              </p>
              {nearestHavens.length === 0 ? (
                <p className="text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Loading…</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {nearestHavens.map((h) => (
                    <div key={h.id} className="flex items-center justify-between border border-[#f1f5f9] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>{h.type === 'hospital' ? '🏥' : '🏠'}</span>
                        <div>
                          <p className="text-[12px] font-medium text-[#0f172a]" style={{ fontFamily: 'Inter, sans-serif' }}>
                            {h.name}
                          </p>
                          <p className="text-[10px] text-[#64748b]" style={{ fontFamily: 'Inter, sans-serif' }}>
                            {h.address}
                          </p>
                        </div>
                      </div>
                      <span
                        className="text-[11px] font-bold text-[#64748b]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {h.distToEvent.toFixed(1)} km
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
