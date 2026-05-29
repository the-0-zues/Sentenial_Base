import { useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo, memo } from 'react'
import Map, { Source, Layer, Marker, Popup, NavigationControl } from '@vis.gl/react-maplibre'
import { MAP_STYLE_URL, NODE_LOCATION } from '../constants'
import { LayerToggle } from './LayerToggle'

const MAG_COLOR = [
  'step',
  ['get', 'magnitude'],
  '#eab308',  // M < 3: yellow
  3, '#f97316', // M 3–4: orange
  4, '#dc2626', // M 4+: red
]

const MAG_RADIUS = [
  'interpolate', ['linear'],
  ['get', 'magnitude'],
  1, 4,
  3, 8,
  5, 16,
  7, 28,
]

const ALL_LAYER_DEFS = [
  { id: 'earthquakes', label: 'USGS EQ', color: '#dc2626', defaultOn: true, responderOnly: true },
  { id: 'havens', label: 'SAFE HAVENS', color: '#2563eb', defaultOn: true },
  { id: 'noaa', label: 'NOAA ALERTS', color: '#dc2626', defaultOn: true },
  { id: 'outages', label: 'PWR OUTAGES', color: '#94a3b8', defaultOn: false, responderOnly: true },
  { id: 'closures', label: 'ROAD CLOSED', color: '#f97316', defaultOn: false },
  { id: 'hurricanes', label: 'HURRICANES', color: '#7c3aed', defaultOn: true },
]

function magColor(mag) {
  if (mag >= 4) return '#dc2626'
  if (mag >= 3) return '#f97316'
  return '#eab308'
}

function formatDepth(d) {
  return d != null ? `${d.toFixed(1)} km` : '—'
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short',
  })
}

const MapPanel = forwardRef(function MapPanel(
  { events = [], havens = [], alerts = [], outages = [], closures = [], telemetry = {}, storms = [], mode = 'responder', userPin = null, onBaseClick },
  ref
) {
  const LAYER_DEFS = useMemo(
    () => mode === 'public' ? ALL_LAYER_DEFS.filter((l) => !l.responderOnly) : ALL_LAYER_DEFS,
    [mode]
  )
  const mapRef = useRef(null)
  const [viewState, setViewState] = useState({
    longitude: NODE_LOCATION[0],
    latitude: NODE_LOCATION[1],
    zoom: 7,
  })
  const [popup, setPopup] = useState(null) // { lng, lat, content }
  const [layerActive, setLayerActive] = useState(() =>
    Object.fromEntries(LAYER_DEFS.map((l) => [l.id, l.defaultOn]))
  )

  useImperativeHandle(ref, () => ({
    flyTo: (lng, lat, zoom = 9) => {
      mapRef.current?.getMap()?.flyTo({ center: [lng, lat], zoom, duration: 1200 })
    },
  }))

  const toggleLayer = useCallback((id) => {
    setLayerActive((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const layers = useMemo(
    () => LAYER_DEFS.map((l) => ({ ...l, active: layerActive[l.id] })),
    [LAYER_DEFS, layerActive]
  )

  // Build USGS GeoJSON
  const usgsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: events.map((e) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: { magnitude: e.magnitude, place: e.place, time: e.time, depth: e.depth, id: e.id },
    })),
  }), [events])

  // Build NOAA polygon GeoJSON
  const noaaGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: alerts
      .filter((f) => f.geometry && ['Polygon', 'MultiPolygon'].includes(f.geometry.type))
      .map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: { event: f.properties?.event, headline: f.properties?.headline },
      })),
  }), [alerts])

  // Build hurricane cone GeoJSON (FeatureCollections per storm, merged)
  const hurricaneConeGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: storms.flatMap((s) =>
      s.cone?.features ?? []
    ),
  }), [storms])

  // Build road closures GeoJSON
  const closuresGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: closures.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: { description: c.description, severity: c.severity, street: c.street, id: c.id },
    })),
  }), [closures])

  // Build outages GeoJSON
  const outagesGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: outages.map((o) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
      properties: { county: o.county, state: o.state, customersOut: o.customersOut, total: o.totalCustomers },
    })),
  }), [outages])

  // Compute interactive layer IDs (only active ones)
  const interactiveLayerIds = useMemo(() => {
    const ids = []
    if (layerActive.earthquakes) ids.push('usgs-circles')
    if (layerActive.closures) ids.push('closures-circles')
    if (layerActive.outages) ids.push('outages-circles')
    return ids
  }, [layerActive])

  const showNode = mode === 'responder'

  const handleMapClick = useCallback((e) => {
    const feat = e.features?.[0]
    if (!feat) {
      const [lng, lat] = e.lngLat.toArray ? e.lngLat.toArray() : [e.lngLat.lng, e.lngLat.lat]
      onBaseClick?.(lat, lng)
      setPopup(null)
      return
    }

    const [lng, lat] = e.lngLat.toArray ? e.lngLat.toArray() : [e.lngLat.lng, e.lngLat.lat]
    const p = feat.properties

    if (feat.layer.id === 'usgs-circles') {
      setPopup({
        lng, lat,
        content: (
          <div className="sentinel-popup">
            <div className="mag-badge" style={{ background: magColor(p.magnitude) }}>
              M{parseFloat(p.magnitude).toFixed(1)}
            </div>
            <h4>{p.place}</h4>
            <p>Time: {formatTime(p.time)}</p>
            <p>Depth: {formatDepth(p.depth)}</p>
          </div>
        ),
      })
    } else if (feat.layer.id === 'closures-circles') {
      setPopup({
        lng, lat,
        content: (
          <div className="sentinel-popup">
            <h4>ROAD CLOSURE</h4>
            <p style={{ fontWeight: 600, color: '#f97316' }}>{p.street}</p>
            <p>{p.description}</p>
            <p style={{ textTransform: 'uppercase', fontSize: 10 }}>
              Severity: {p.severity}
            </p>
          </div>
        ),
      })
    } else if (feat.layer.id === 'outages-circles') {
      const pct = ((p.customersOut / p.total) * 100).toFixed(1)
      setPopup({
        lng, lat,
        content: (
          <div className="sentinel-popup">
            <h4>POWER OUTAGE</h4>
            <p style={{ fontWeight: 600 }}>{p.county} County, {p.state}</p>
            <p>{p.customersOut.toLocaleString()} customers affected</p>
            <p>{pct}% of service area</p>
          </div>
        ),
      })
    }
  }, [])

  const deltaT = telemetry?.deltaT
  const lastDetection = telemetry?.nodeAlertTime

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        mapStyle={MAP_STYLE_URL}
        onClick={handleMapClick}
        interactiveLayerIds={interactiveLayerIds}
        style={{ width: '100%', height: '100%' }}
        cursor="default"
      >
        <NavigationControl position="bottom-right" />

        {/* USGS Earthquakes */}
        {layerActive.earthquakes && (
          <Source id="usgs" type="geojson" data={usgsGeoJSON}>
            <Layer
              id="usgs-circles"
              type="circle"
              paint={{
                'circle-radius': MAG_RADIUS,
                'circle-color': MAG_COLOR,
                'circle-opacity': 0.85,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': 'rgba(255,255,255,0.6)',
              }}
            />
            <Layer
              id="usgs-labels"
              type="symbol"
              layout={{
                'text-field': ['to-string', ['round', ['get', 'magnitude']]],
                'text-size': 10,
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Regular'],
                'text-anchor': 'center',
              }}
              paint={{
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(0,0,0,0.3)',
                'text-halo-width': 0.5,
              }}
              filter={['>=', ['get', 'magnitude'], 2.5]}
            />
          </Source>
        )}

        {/* NOAA Weather Alerts */}
        {layerActive.noaa && noaaGeoJSON.features.length > 0 && (
          <Source id="noaa" type="geojson" data={noaaGeoJSON}>
            <Layer
              id="noaa-fill"
              type="fill"
              paint={{
                'fill-color': '#dc2626',
                'fill-opacity': 0.07,
              }}
            />
            <Layer
              id="noaa-outline"
              type="line"
              paint={{
                'line-color': '#dc2626',
                'line-width': 1.2,
                'line-opacity': 0.45,
                'line-dasharray': [3, 2],
              }}
            />
          </Source>
        )}

        {/* Power Outages */}
        {layerActive.outages && (
          <Source id="outages" type="geojson" data={outagesGeoJSON}>
            <Layer
              id="outages-circles"
              type="circle"
              paint={{
                'circle-radius': [
                  'interpolate', ['linear'],
                  ['get', 'customersOut'],
                  500, 18, 5000, 28, 15000, 40,
                ],
                'circle-color': 'rgba(100,116,139,0.22)',
                'circle-stroke-color': '#94a3b8',
                'circle-stroke-width': 1.5,
                'circle-opacity': 0.9,
              }}
            />
            <Layer
              id="outages-labels"
              type="symbol"
              layout={{
                'text-field': [
                  'concat',
                  ['to-string', ['round', ['/', ['get', 'customersOut'], 1000]]],
                  'k out',
                ],
                'text-size': 10,
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Regular'],
                'text-anchor': 'center',
              }}
              paint={{
                'text-color': '#334155',
                'text-halo-color': 'rgba(255,255,255,0.8)',
                'text-halo-width': 1,
              }}
            />
          </Source>
        )}

        {/* Road Closures */}
        {layerActive.closures && (
          <Source id="closures" type="geojson" data={closuresGeoJSON}>
            <Layer
              id="closures-circles"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': '#f97316',
                'circle-stroke-color': '#ea580c',
                'circle-stroke-width': 2,
                'circle-opacity': 0.9,
              }}
            />
            <Layer
              id="closures-labels"
              type="symbol"
              layout={{
                'text-field': '✕',
                'text-size': 9,
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Regular'],
                'text-anchor': 'center',
              }}
              paint={{ 'text-color': '#ffffff' }}
            />
          </Source>
        )}

        {/* Hurricane cone + markers */}
        {layerActive.hurricanes && hurricaneConeGeoJSON.features.length > 0 && (
          <Source id="hurricane-cone" type="geojson" data={hurricaneConeGeoJSON}>
            <Layer
              id="hurricane-cone-fill"
              type="fill"
              paint={{ 'fill-color': '#7c3aed', 'fill-opacity': 0.12 }}
            />
            <Layer
              id="hurricane-cone-outline"
              type="line"
              paint={{ 'line-color': '#7c3aed', 'line-width': 1.5, 'line-opacity': 0.5, 'line-dasharray': [3, 2] }}
            />
          </Source>
        )}
        {layerActive.hurricanes && storms.map((s) => (
          <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="center"
            onClick={(e) => {
              e.originalEvent?.stopPropagation()
              setPopup({
                lng: s.lng, lat: s.lat,
                content: (
                  <div className="sentinel-popup">
                    <h4>🌀 {s.classification} {s.name}</h4>
                    <p style={{ fontWeight: 600 }}>{s.intensity} mph max winds</p>
                    {s.pressure && <p>{s.pressure} mb central pressure</p>}
                    <p>Moving {s.movementDir}° at {s.movementSpeed} mph</p>
                  </div>
                ),
              })
            }}
          >
            <div
              style={{
                background: '#7c3aed', color: '#fff',
                padding: '3px 7px', fontSize: 10, fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                display: 'flex', alignItems: 'center', gap: 4,
                boxShadow: '0 0 0 2px rgba(124,58,237,0.4)',
              }}
            >
              🌀 {s.classification}
            </div>
          </Marker>
        ))}

        {/* Safe Haven markers */}
        {layerActive.havens &&
          havens.map((h) => (
            <Marker
              key={h.id}
              longitude={h.lng}
              latitude={h.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent?.stopPropagation()
                setPopup({
                  lng: h.lng,
                  lat: h.lat,
                  content: (
                    <div className="sentinel-popup">
                      <h4>{h.type === 'hospital' ? '🏥 HOSPITAL' : '🏠 SHELTER'}</h4>
                      <p style={{ fontWeight: 600, color: '#0f172a' }}>{h.name}</p>
                      <p>{h.address}</p>
                      <p>{h.distanceKm} km from NODE-01</p>
                      <p style={{ color: '#16a34a', fontWeight: 600 }}>● {h.status}</p>
                    </div>
                  ),
                })
              }}
            >
              <div className={`haven-marker ${h.type}`} title={h.name}>
                {h.type === 'hospital' ? '+' : '⌂'}
              </div>
            </Marker>
          ))}

        {/* User location pin */}
        {userPin && (
          <Marker longitude={userPin.lng} latitude={userPin.lat} anchor="center">
            <div style={{ position: 'relative', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span
                style={{
                  position: 'absolute', width: 28, height: 28, borderRadius: '50%',
                  background: '#2563eb', opacity: 0.25,
                  animation: 'node-pulse 1.6s ease-out infinite',
                }}
              />
              <span
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: '#ffffff', border: '3px solid #2563eb',
                  boxShadow: '0 1px 4px rgba(37,99,235,0.5)',
                  position: 'relative',
                }}
                title="YOUR LOCATION"
              />
            </div>
          </Marker>
        )}

        {/* NODE-01 marker — responder mode only */}
        {showNode && <Marker
          longitude={NODE_LOCATION[0]}
          latitude={NODE_LOCATION[1]}
          anchor="center"
          onClick={(e) => {
            e.originalEvent?.stopPropagation()
            const secs = lastDetection ? ((Date.now() - lastDetection) / 1000).toFixed(1) : '—'
            setPopup({
              lng: NODE_LOCATION[0],
              lat: NODE_LOCATION[1],
              content: (
                <div className="sentinel-popup">
                  <h4>NODE-01</h4>
                  <p>Sub-20Hz FPGA Sensor</p>
                  <p>Digilent Arty S7-50 (XC7S50)</p>
                  {deltaT != null && (
                    <p style={{ color: '#2563eb', fontWeight: 600 }}>
                      {deltaT}s ahead of USGS
                    </p>
                  )}
                  <p>Last detection: {secs}s ago</p>
                </div>
              ),
            })
          }}
        >
          <div className="node-marker" title="NODE-01 · FPGA Sensor" />
        </Marker>}

        {/* Popup */}
        {popup && (
          <Popup
            longitude={popup.lng}
            latitude={popup.lat}
            onClose={() => setPopup(null)}
            closeOnClick={false}
            anchor="bottom"
            offset={12}
          >
            {popup.content}
          </Popup>
        )}
      </Map>

      {/* Layer toggles */}
      <div className="absolute top-3 right-3 z-10">
        <LayerToggle layers={layers} onToggle={toggleLayer} />
      </div>
    </div>
  )
})

const MemoMapPanel = memo(MapPanel)
export { MemoMapPanel as MapPanel }
