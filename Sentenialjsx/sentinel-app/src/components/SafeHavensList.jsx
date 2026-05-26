import { useState } from 'react'

const FILTERS = ['ALL', 'HOSPITALS', 'SHELTERS']

export function SafeHavensList({ havens = [], loading, onSelect, selectedId }) {
  const [filter, setFilter] = useState('ALL')

  const filtered = havens.filter((h) => {
    if (filter === 'HOSPITALS') return h.type === 'hospital'
    if (filter === 'SHELTERS') return h.type === 'shelter'
    return true
  })

  return (
    <div className="flex flex-col h-full bg-white border-r border-[#e2e8f0]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#e2e8f0] flex-shrink-0">
        <h1
          className="text-[10px] font-bold uppercase tracking-widest text-[#64748b] mb-2"
          style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.14em' }}
        >
          SAFE HAVENS
        </h1>
        <div className="flex gap-0 border border-[#e2e8f0]">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.08em',
                background: filter === f ? '#1e3a5f' : '#ffffff',
                color: filter === f ? '#ffffff' : '#64748b',
                borderRight: f !== 'SHELTERS' ? '1px solid #e2e8f0' : 'none',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="px-4 py-2 border-b border-[#f1f5f9] flex-shrink-0">
        <span
          className="text-[10px] text-[#94a3b8]"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {filtered.length} LOCATION{filtered.length !== 1 ? 'S' : ''}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            LOADING…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-[#94a3b8]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            NO RESULTS
          </div>
        ) : (
          filtered.map((h) => (
            <button
              key={h.id}
              onClick={() => onSelect?.(h)}
              className="w-full text-left px-4 py-3 border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors cursor-pointer"
              style={{
                background: selectedId === h.id ? '#eff6ff' : undefined,
                borderLeft: selectedId === h.id ? '3px solid #2563eb' : '3px solid transparent',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {h.type === 'hospital' ? '🏥' : '🏠'}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-[12px] font-semibold text-[#0f172a] leading-tight truncate"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {h.name}
                    </p>
                    <p
                      className="text-[10px] text-[#64748b] mt-0.5 truncate"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {h.address}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span
                        className="text-[9px] font-bold uppercase text-[#64748b]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {h.type}
                      </span>
                      <span
                        className="text-[9px] font-bold uppercase text-[#16a34a]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        ● {h.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p
                    className="text-[11px] font-bold text-[#0f172a]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {h.distanceKm} km
                  </p>
                  <p
                    className="text-[9px] text-[#94a3b8]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    from NODE-01
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
