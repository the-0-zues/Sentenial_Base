import { memo } from 'react'

function timeSince(ts) {
  const diff = (Date.now() - ts) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function MagBadge({ mag }) {
  let bg, text
  if (mag >= 4) {
    bg = '#dc2626'
    text = '#ffffff'
  } else if (mag >= 3) {
    bg = '#f97316'
    text = '#ffffff'
  } else {
    bg = '#eab308'
    text = '#0f172a'
  }
  return (
    <span
      className="inline-flex items-center justify-center font-bold text-[10px] flex-shrink-0"
      style={{
        background: bg,
        color: text,
        width: 36,
        height: 20,
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: '0.02em',
      }}
    >
      M{parseFloat(mag).toFixed(1)}
    </span>
  )
}

export const EarthquakeList = memo(function EarthquakeList({ events = [], onEventClick }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#e2e8f0] flex-shrink-0">
        <h2
          className="text-[10px] font-bold uppercase tracking-widest text-[#64748b] m-0"
          style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em' }}
        >
          RECENT SEISMIC EVENTS
        </h2>
        <div className="grid grid-cols-3 mt-2 pb-1 border-b border-[#e2e8f0]">
          {['M', 'LOCATION', 'TIME'].map((h) => (
            <span
              key={h}
              className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8]"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {h}
            </span>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            Loading events…
          </div>
        ) : (
          events.slice(0, 50).map((ev, i) => (
            <button
              key={ev.id}
              onClick={() => onEventClick?.(ev)}
              className="w-full grid grid-cols-3 items-center gap-1 px-3 py-2 border-b border-[#f1f5f9] text-left hover:bg-[#f8fafc] transition-colors cursor-pointer"
              style={{ background: i % 2 === 0 ? '#ffffff' : '#fafbfc' }}
            >
              <span>
                <MagBadge mag={ev.magnitude} />
              </span>
              <span
                className="text-[10px] text-[#0f172a] leading-tight truncate"
                style={{ fontFamily: 'Inter, sans-serif' }}
                title={ev.place}
              >
                {ev.place?.replace(/^[\d.]+ km [A-Z]+ of /, '') ?? '—'}
              </span>
              <span
                className="text-[9px] text-[#94a3b8] text-right"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {timeSince(ev.time)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
})
