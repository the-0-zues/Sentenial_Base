export function InsightsBar({ message, isHazard }) {
  if (!message) return null

  return (
    <div
      className={[
        'flex-shrink-0 flex items-center gap-3 px-4 py-2 text-sm font-medium border-b',
        isHazard
          ? 'bg-[#fffbeb] border-amber-200 text-[#0f172a]'
          : 'bg-[#f0fdf4] border-green-200 text-[#0f172a]',
      ].join(' ')}
    >
      {/* Pulsing status dot */}
      <span className="relative flex-shrink-0 flex items-center justify-center w-4 h-4">
        <span
          className={[
            'absolute inline-flex w-4 h-4 opacity-60',
            isHazard ? 'bg-amber-400' : 'bg-green-400',
          ].join(' ')}
          style={{ animation: 'node-pulse 1.6s ease-out infinite' }}
        />
        <span
          className={[
            'relative inline-flex w-2.5 h-2.5',
            isHazard ? 'bg-amber-500' : 'bg-green-500',
          ].join(' ')}
        />
      </span>

      <span
        className="font-mono text-xs tracking-wide truncate"
        style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.03em' }}
      >
        {message}
      </span>
    </div>
  )
}
