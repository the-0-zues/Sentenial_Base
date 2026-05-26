import { WaveformSparkline } from './WaveformSparkline'

function timeSince(ts) {
  if (!ts) return '—'
  const diff = (Date.now() - ts) / 1000
  if (diff < 1) return `${(diff).toFixed(1)}s ago`
  if (diff < 60) return `${diff.toFixed(0)}s ago`
  return `${Math.floor(diff / 60)}m ago`
}

export function NodeStatusBar({ amplitude, timestamp }) {
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-10 flex-shrink-0"
      style={{ background: '#1e3a5f', borderTop: '1px solid rgba(255,255,255,0.1)' }}
    >
      {/* Left: Node status */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-bold tracking-widest uppercase"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#94a3b8', letterSpacing: '0.12em' }}
        >
          NODE-01
        </span>
        <span
          className="inline-block w-2 h-2 flex-shrink-0"
          style={{ background: '#4af626', boxShadow: '0 0 4px #4af626' }}
        />
        <span
          className="text-[10px] font-bold tracking-widest uppercase"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#4af626', letterSpacing: '0.1em' }}
        >
          NOMINAL
        </span>
      </div>

      {/* Center: Amplitude + waveform */}
      <div className="flex items-center gap-3">
        <span
          className="text-[11px] font-medium"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#94a3b8' }}
        >
          Amplitude:{' '}
          <span style={{ color: '#e2e8f0' }}>
            {amplitude != null ? `${amplitude.toFixed(1)} nm` : '— nm'}
          </span>
        </span>
        <WaveformSparkline amplitude={amplitude} />
      </div>

      {/* Right: Last sync */}
      <div>
        <span
          className="text-[10px]"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#64748b' }}
        >
          Last sync:{' '}
          <span style={{ color: '#94a3b8' }}>{timeSince(timestamp)}</span>
        </span>
      </div>
    </footer>
  )
}
