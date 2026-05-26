import { useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

const BUFFER_SIZE = 150

export function WaveformSparkline({ amplitude }) {
  const [buffer, setBuffer] = useState(() =>
    Array.from({ length: BUFFER_SIZE }, (_, i) => ({
      i,
      v: 55 + Math.random() * 40,
    }))
  )

  useEffect(() => {
    if (amplitude == null) return
    setBuffer((prev) => {
      const next = prev.slice(1)
      next.push({ i: (prev[prev.length - 1]?.i ?? 0) + 1, v: amplitude })
      return next
    })
  }, [amplitude])

  return (
    <div className="waveform-container">
      <ResponsiveContainer width="100%" height={26}>
        <LineChart data={buffer} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke="#4af626"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
