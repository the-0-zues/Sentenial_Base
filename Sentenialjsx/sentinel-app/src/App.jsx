import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTelemetry } from './hooks/useTelemetry'
import { useInsights } from './hooks/useInsights'
import { useUSGS } from './hooks/useUSGS'
import { useSafeHavens } from './hooks/useSafeHavens'
import { useRoadClosures } from './hooks/useRoadClosures'
import { TopNav } from './components/TopNav'
import { InsightsBar } from './components/InsightsBar'
import { NodeStatusBar } from './components/NodeStatusBar'
import { Dashboard } from './pages/Dashboard'
import { Earthquakes } from './pages/Earthquakes'
import { SafeHavens } from './pages/SafeHavens'
import { About } from './pages/About'

// Top-level shell — owns persistent state shared across nav
function AppShell() {
  const telemetry = useTelemetry()
  const usgs = useUSGS()
  const { havens } = useSafeHavens()
  const { closures } = useRoadClosures()

  const insight = useInsights({
    telemetry,
    usgsEvents: usgs.events,
    safeHavens: havens,
    roadClosures: closures,
  })

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <TopNav />
      <InsightsBar message={insight.message} isHazard={insight.isHazard} />

      {/* Main content area — Dashboard fills height, other pages scroll */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard telemetry={telemetry} />} />
          <Route path="/earthquakes" element={<div className="h-full overflow-auto"><Earthquakes /></div>} />
          <Route path="/safe-havens" element={<SafeHavens />} />
          <Route path="/about" element={<div className="h-full overflow-auto"><About /></div>} />
        </Routes>
      </main>

      {/* Persistent bottom bar — pb accounts for its fixed height */}
      <div style={{ height: 40, flexShrink: 0 }} />
      <NodeStatusBar amplitude={telemetry.amplitude} timestamp={telemetry.timestamp} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
