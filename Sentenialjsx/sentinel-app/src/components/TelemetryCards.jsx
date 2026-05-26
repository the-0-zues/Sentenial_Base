import { Link } from 'react-router-dom'

function StatusDot({ ok }) {
  return (
    <span
      className="inline-block w-2 h-2 flex-shrink-0"
      style={{
        background: ok ? '#16a34a' : '#dc2626',
        boxShadow: ok ? '0 0 4px #16a34a' : 'none',
      }}
    />
  )
}

function timeSince(ts) {
  if (!ts) return '—'
  const diff = (Date.now() - ts) / 1000
  if (diff < 2) return `${(diff).toFixed(1)}s ago`
  if (diff < 60) return `${Math.round(diff)}s ago`
  return `${Math.floor(diff / 60)}m ago`
}

function SectionLabel({ children }) {
  return (
    <p
      className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2"
      style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.14em' }}
    >
      {children}
    </p>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-[#e2e8f0] p-3 ${className}`}>
      {children}
    </div>
  )
}

export function TelemetryCards({ telemetry, usgsStatus, noaaStatus, havens = [] }) {
  const { amplitude, hazardDetected, timestamp } = telemetry ?? {}

  const hazardIndex = hazardDetected
    ? Math.min(95, 60 + Math.random() * 30)
    : Math.max(0, (amplitude ?? 0) / 4.0)
  const hazardPct = parseFloat(hazardIndex.toFixed(0))
  const hazardColor =
    hazardPct >= 75 ? '#dc2626' : hazardPct >= 50 ? '#d97706' : '#16a34a'

  const topHavens = [...havens].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3)

  return (
    <div className="flex flex-col gap-0 h-full overflow-y-auto">
      {/* Card 1 — Seismic Data */}
      <Card>
        <SectionLabel>RECENT SEISMIC DATA</SectionLabel>
        <div className="mb-3">
          <p className="text-[10px] text-[#64748b] mb-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
            Seismic Amplitude
          </p>
          <p
            className="text-3xl font-black leading-none tracking-tight"
            style={{ fontFamily: 'Inter, sans-serif', color: '#0f172a' }}
          >
            {amplitude != null ? `${amplitude.toFixed(1)}` : '—'}
            <span className="text-sm font-medium text-[#64748b] ml-1">nm</span>
          </p>
        </div>
        <div className="border-t border-[#f1f5f9] pt-2.5">
          <p className="text-[10px] text-[#64748b] mb-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
            Hazard Index
          </p>
          <p
            className="text-3xl font-black leading-none"
            style={{ fontFamily: 'Inter, sans-serif', color: hazardColor }}
          >
            {hazardPct}
            <span className="text-sm font-medium ml-0.5" style={{ color: hazardColor }}>%</span>
          </p>
          <div className="mt-2 h-1.5 bg-[#f1f5f9] overflow-hidden">
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${hazardPct}%`, background: hazardColor }}
            />
          </div>
        </div>
        <p className="text-[9px] text-[#94a3b8] mt-2" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          Last updated: {timeSince(timestamp)}
        </p>
      </Card>

      {/* Divider */}
      <div className="h-px bg-[#e2e8f0]" />

      {/* Card 2 — Status */}
      <Card>
        <SectionLabel>STATUS</SectionLabel>
        <div className="flex flex-col gap-2.5">
          {[
            { label: 'NODE STATUS', value: 'Nominal', ok: true, ts: timestamp },
            { label: 'USGS STATUS', value: usgsStatus?.error ? 'Error' : 'Live', ok: !usgsStatus?.error, ts: usgsStatus?.lastFetch },
            { label: 'NOAA STATUS', value: noaaStatus?.error ? 'Error' : 'Live', ok: !noaaStatus?.error, ts: noaaStatus?.lastFetch },
          ].map(({ label, value, ok, ts }) => (
            <div key={label} className="flex items-center justify-between">
              <div>
                <p
                  className="text-[9px] font-bold uppercase tracking-widest text-[#64748b] mb-0.5"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.1em' }}
                >
                  {label}
                </p>
                <div className="flex items-center gap-1.5">
                  <StatusDot ok={ok} />
                  <span
                    className="text-sm font-bold"
                    style={{ fontFamily: 'Inter, sans-serif', color: ok ? '#16a34a' : '#dc2626' }}
                  >
                    {value}
                  </span>
                </div>
              </div>
              <span
                className="text-[9px] text-[#94a3b8]"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {timeSince(ts)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Divider */}
      <div className="h-px bg-[#e2e8f0]" />

      {/* Card 3 — Nearest Safe Havens */}
      <Card>
        <SectionLabel>NEAREST SAFE HAVENS</SectionLabel>
        {topHavens.length === 0 ? (
          <p className="text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Loading…
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {topHavens.map((h) => (
              <div key={h.id} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm flex-shrink-0">{h.type === 'hospital' ? '🏥' : '🏠'}</span>
                  <span
                    className="text-[11px] font-medium text-[#0f172a] truncate"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {h.name}
                  </span>
                </div>
                <span
                  className="text-[10px] font-bold text-[#64748b] flex-shrink-0 ml-2"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {h.distanceKm} km
                </span>
              </div>
            ))}
          </div>
        )}
        <Link
          to="/safe-havens"
          className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-[#2563eb] no-underline hover:underline"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          View All →
        </Link>
      </Card>

      {/* Card 4 — Data Sources quick ref */}
      <Card className="flex-shrink-0">
        <SectionLabel>DATA SOURCES</SectionLabel>
        <div className="flex flex-col gap-1.5">
          {[
            { name: 'USGS Earthquake Feed', ok: !usgsStatus?.error },
            { name: 'NOAA Weather Alerts', ok: !noaaStatus?.error },
            { name: 'NODE-01 Sensor', ok: true },
            { name: 'OpenStreetMap', ok: true, note: 'Cached' },
          ].map(({ name, ok, note }) => (
            <div key={name} className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 flex-shrink-0"
                style={{ background: ok ? '#16a34a' : '#dc2626' }}
              />
              <span
                className="text-[10px] text-[#64748b]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {name}
                {note && <span className="text-[#94a3b8]"> — {note}</span>}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
