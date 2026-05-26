import { useState, useRef, useCallback } from 'react'
import Map, { Marker, Popup } from '@vis.gl/react-maplibre'
import { useSafeHavens } from '../hooks/useSafeHavens'
import { SafeHavensList } from '../components/SafeHavensList'
import { MAP_STYLE_URL, NODE_LOCATION } from '../constants'

export function SafeHavens() {
  const mapRef = useRef(null)
  const { havens, loading } = useSafeHavens()
  const [selected, setSelected] = useState(null)
  const [popup, setPopup] = useState(null)

  const [viewState, setViewState] = useState({
    longitude: NODE_LOCATION[0],
    latitude: NODE_LOCATION[1],
    zoom: 10,
  })

  const handleSelect = useCallback((haven) => {
    setSelected(haven)
    setPopup(haven)
    mapRef.current?.getMap()?.flyTo({
      center: [haven.lng, haven.lat],
      zoom: 13,
      duration: 1000,
    })
  }, [])

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className="w-[40%] flex-shrink-0 overflow-hidden">
        <SafeHavensList
          havens={havens}
          loading={loading}
          onSelect={handleSelect}
          selectedId={selected?.id}
        />
      </div>

      {/* Right: map */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(e) => setViewState(e.viewState)}
          mapStyle={MAP_STYLE_URL}
          style={{ width: '100%', height: '100%' }}
        >
          {/* NODE-01 marker */}
          <Marker longitude={NODE_LOCATION[0]} latitude={NODE_LOCATION[1]} anchor="center">
            <div className="node-marker" title="NODE-01" />
          </Marker>

          {/* Haven markers */}
          {havens.map((h) => (
            <Marker
              key={h.id}
              longitude={h.lng}
              latitude={h.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent?.stopPropagation()
                setSelected(h)
                setPopup(h)
              }}
            >
              <div
                className={`haven-marker ${h.type}`}
                title={h.name}
                style={{
                  transform: selected?.id === h.id ? 'scale(1.25)' : undefined,
                  boxShadow: selected?.id === h.id ? '0 0 0 3px #2563eb' : undefined,
                  zIndex: selected?.id === h.id ? 10 : undefined,
                }}
              >
                {h.type === 'hospital' ? '+' : '⌂'}
              </div>
            </Marker>
          ))}

          {/* Popup */}
          {popup && (
            <Popup
              longitude={popup.lng}
              latitude={popup.lat}
              onClose={() => setPopup(null)}
              anchor="bottom"
              offset={14}
            >
              <div className="sentinel-popup">
                <h4>{popup.type === 'hospital' ? '🏥 HOSPITAL' : '🏠 SHELTER'}</h4>
                <p style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{popup.name}</p>
                <p>{popup.address}</p>
                <p>{popup.distanceKm} km from NODE-01</p>
                <p style={{ color: '#16a34a', fontWeight: 600 }}>● {popup.status}</p>
              </div>
            </Popup>
          )}
        </Map>

        {/* Legend overlay */}
        <div
          className="absolute bottom-4 left-4 z-10 bg-white border border-[#e2e8f0] px-3 py-2.5"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-2"
            style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em' }}
          >
            LEGEND
          </p>
          <div className="flex flex-col gap-1.5">
            {[
              { type: 'hospital', label: 'Hospital', color: '#2563eb', icon: '+' },
              { type: 'shelter', label: 'Shelter', color: '#16a34a', icon: '⌂' },
            ].map(({ label, color, icon }) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-5 h-5 text-white text-xs font-bold"
                  style={{ background: color }}
                >
                  {icon}
                </span>
                <span
                  className="text-[10px] text-[#64748b]"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {label}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5">
                <span
                  className="w-3 h-3"
                  style={{ background: '#2563eb', border: '2px solid white', boxShadow: '0 0 0 2px #2563eb' }}
                />
              </span>
              <span className="text-[10px] text-[#64748b]" style={{ fontFamily: 'Inter, sans-serif' }}>
                NODE-01
              </span>
            </div>
          </div>
          <p
            className="text-[9px] text-[#94a3b8] mt-2 border-t border-[#f1f5f9] pt-1.5"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {havens.length} LOCATIONS SHOWN
          </p>
        </div>
      </div>
    </div>
  )
}
