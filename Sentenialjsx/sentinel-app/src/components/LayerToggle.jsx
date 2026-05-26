export function LayerToggle({ layers, onToggle }) {
  return (
    <div className="flex flex-col gap-1">
      {layers.map((layer) => (
        <button
          key={layer.id}
          onClick={() => onToggle(layer.id)}
          className="flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors cursor-pointer"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: '0.1em',
            background: layer.active ? '#1e3a5f' : 'rgba(255,255,255,0.92)',
            color: layer.active ? '#ffffff' : '#64748b',
            borderColor: layer.active ? '#1e3a5f' : '#e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <span
            className="w-2 h-2 flex-shrink-0"
            style={{ background: layer.active ? layer.color : '#cbd5e1' }}
          />
          {layer.label}
        </button>
      ))}
    </div>
  )
}
