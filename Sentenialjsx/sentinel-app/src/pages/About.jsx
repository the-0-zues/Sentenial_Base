function SectionTitle({ children }) {
  return (
    <h2
      className="text-[11px] font-bold uppercase tracking-widest text-[#64748b] mb-4"
      style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.14em' }}
    >
      {children}
    </h2>
  )
}

function Divider() {
  return <hr className="border-t border-[#e2e8f0] my-10" />
}

function SimulatedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        background: '#fffbeb',
        color: '#d97706',
        border: '1px solid #fcd34d',
        letterSpacing: '0.08em',
      }}
    >
      ⚠ SIMULATED
    </span>
  )
}

const DATA_SOURCES = [
  {
    source: 'USGS Earthquake API',
    data: 'Seismic events, magnitude, location, depth',
    freq: 'Real-time (60s poll)',
    reliability: 'High',
    status: 'live',
  },
  {
    source: 'NOAA Weather API',
    data: 'Active severe weather alerts',
    freq: '5 min (300s poll)',
    reliability: 'High',
    status: 'live',
  },
  {
    source: 'NODE-01 FPGA Sensor',
    data: 'Sub-20Hz seismic amplitude @ 244Hz',
    freq: 'Real-time (100ms)',
    reliability: 'High',
    status: 'live',
  },
  {
    source: 'OpenStreetMap Overpass',
    data: 'Hospital & shelter locations',
    freq: 'Cached (on map move)',
    reliability: 'Medium',
    status: 'live',
  },
  {
    source: 'ODIN — Oak Ridge National Lab',
    data: 'County-level power outages',
    freq: '15 min (simulated)',
    reliability: 'Medium',
    status: 'simulated',
  },
  {
    source: 'OpenWeb Ninja Traffic API',
    data: 'Road closures & incidents',
    freq: '2 min (simulated)',
    reliability: 'Medium',
    status: 'simulated',
  },
]

export function About() {
  return (
    <div className="overflow-y-auto h-full bg-[#f8fafc]">
      <div className="max-w-3xl mx-auto px-8 py-12">

        {/* Section 1 — About Sentinel */}
        <SectionTitle>ABOUT SENTINEL</SectionTitle>
        <h1
          className="text-3xl font-black tracking-tight text-[#0f172a] mb-4"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Earthquake Early Warning<br />& Emergency Response Dashboard
        </h1>
        <p className="text-[14px] text-[#334155] leading-relaxed mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
          Sentinel is a professional geospatial situational awareness platform built for the
          <strong> 2026 IEEE Response Quest Challenge</strong>. It integrates real-time seismic data
          from the USGS, live weather alerts from NOAA, and a custom FPGA-based sub-20Hz sensor (NODE-01)
          to provide earlier-than-USGS earthquake detection for emergency responders.
        </p>
        <p className="text-[14px] text-[#334155] leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
          The dashboard maps nearby safe havens, power outages, and road closures to give first
          responders a unified operational picture in the critical seconds after a seismic event.
        </p>

        <Divider />

        {/* Section 2 — How It Works */}
        <SectionTitle>HOW IT WORKS</SectionTitle>
        <p className="text-[14px] text-[#334155] leading-relaxed mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
          NODE-01 detects sub-20Hz P-wave energy — the low-frequency precursor that arrives before
          the destructive S-wave — giving 0.3–1.2 seconds of lead time over USGS magnitude-threshold
          confirmation.
        </p>

        {/* Pipeline diagram */}
        <div
          className="border border-[#e2e8f0] bg-white p-6 mb-6"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-widest text-[#94a3b8] mb-4"
            style={{ letterSpacing: '0.12em' }}
          >
            SIGNAL PIPELINE
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#0f172a]">
            {[
              { label: 'FPGA', sub: 'Arty S7-50\n104MHz' },
              '→',
              { label: 'XADC', sub: '153kHz\nsample rate' },
              '→',
              { label: 'CIC FILTER', sub: 'decimate\n→ 244Hz' },
              '→',
              { label: 'FIR FILTER', sub: '15-tap\n20Hz LPF' },
              '→',
              { label: 'UART', sub: '8-byte frame\n115200 baud' },
              '→',
              { label: 'Pi 4', sub: 'Node.js\nWebSocket' },
              '→',
              { label: 'DASHBOARD', sub: 'React\nbrowser' },
            ].map((item, i) =>
              typeof item === 'string' ? (
                <span key={i} className="text-[#94a3b8] text-lg">→</span>
              ) : (
                <div
                  key={i}
                  className="border border-[#e2e8f0] px-3 py-2 text-center"
                  style={{ minWidth: 72 }}
                >
                  <p className="font-bold text-[11px] text-[#0f172a]">{item.label}</p>
                  <p className="text-[9px] text-[#94a3b8] whitespace-pre-line mt-0.5">{item.sub}</p>
                </div>
              )
            )}
          </div>
        </div>

        <p className="text-[14px] text-[#334155] leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
          The Raspberry Pi 4 gateway reads 8-byte UART frames at 115200 baud and streams them over
          WebSocket to the dashboard. In production, the dashboard connects directly to{' '}
          <code
            className="text-[12px] px-1.5 py-0.5"
            style={{ fontFamily: "'IBM Plex Mono', monospace", background: '#f1f5f9', color: '#1e3a5f' }}
          >
            ws://192.168.4.1:8080
          </code>{' '}
          on the local Pi hotspot. The demo uses a mock sensor with identical frame structure.
        </p>

        <Divider />

        {/* Section 3 — Data Sources */}
        <SectionTitle>DATA SOURCES</SectionTitle>
        <div className="border border-[#e2e8f0] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f1f5f9]">
                {['SOURCE', 'DATA', 'UPDATE FREQ', 'RELIABILITY', 'STATUS'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left border-b border-[#e2e8f0]"
                    style={{ borderRight: '1px solid #e2e8f0' }}
                  >
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest text-[#64748b]"
                      style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.1em' }}
                    >
                      {h}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DATA_SOURCES.map((row, i) => (
                <tr
                  key={row.source}
                  className="border-b border-[#f1f5f9]"
                  style={{ background: i % 2 === 0 ? '#ffffff' : '#fafbfc' }}
                >
                  <td
                    className="px-4 py-3 text-[12px] font-semibold text-[#0f172a]"
                    style={{ fontFamily: 'Inter, sans-serif', borderRight: '1px solid #f1f5f9' }}
                  >
                    {row.source}
                  </td>
                  <td
                    className="px-4 py-3 text-[11px] text-[#334155]"
                    style={{ fontFamily: 'Inter, sans-serif', borderRight: '1px solid #f1f5f9' }}
                  >
                    {row.data}
                  </td>
                  <td
                    className="px-4 py-3 text-[10px] text-[#64748b]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", borderRight: '1px solid #f1f5f9' }}
                  >
                    {row.freq}
                  </td>
                  <td
                    className="px-4 py-3 text-[10px]"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: row.reliability === 'High' ? '#16a34a' : '#d97706',
                      borderRight: '1px solid #f1f5f9',
                    }}
                  >
                    {row.reliability}
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'simulated' ? (
                      <SimulatedBadge />
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16a34a]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        ● LIVE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="mt-4 border border-amber-200 bg-[#fffbeb] px-4 py-3 flex items-start gap-2"
        >
          <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
          <p className="text-[12px] text-[#92400e]" style={{ fontFamily: 'Inter, sans-serif' }}>
            <strong>ODIN</strong> (Oak Ridge National Laboratory power outage data) and{' '}
            <strong>OpenWeb Ninja</strong> (road closures) use simulated representative data pending
            live API integration. All other data sources are live.
          </p>
        </div>

        <Divider />

        {/* Section 4 — Limitations */}
        <SectionTitle>LIMITATIONS & DISCLAIMERS</SectionTitle>
        <div
          className="border border-[#e2e8f0] bg-white p-5 mb-4"
          style={{ borderLeft: '4px solid #dc2626' }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-widest text-[#dc2626] mb-3"
            style={{ fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.1em' }}
          >
            IMPORTANT NOTICE
          </p>
          <ul className="flex flex-col gap-2.5">
            {[
              'This tool does not replace official emergency services. Always follow guidance from local emergency management.',
              'NODE-01 detection is experimental and unconfirmed until corroborated by USGS. Early warnings are provisional.',
              'Safe haven capacity data may not reflect real-time operational status. Verify availability before directing evacuees.',
              'Road closure data is simulated in this demonstration build. Live integration is planned.',
              'Power outage data is simulated in this demonstration build. Live ODIN integration is planned.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[#dc2626] flex-shrink-0 mt-0.5 font-bold">—</span>
                <p className="text-[13px] text-[#334155] leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {item}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <Divider />

        {/* Section 5 — Technical Specs */}
        <SectionTitle>TECHNICAL SPECIFICATIONS</SectionTitle>
        <div className="border border-[#e2e8f0] bg-white overflow-hidden">
          <table className="w-full border-collapse">
            <tbody>
              {[
                ['FPGA Platform', 'Digilent Arty S7-50 (Xilinx XC7S50)'],
                ['Clock', '104 MHz system clock'],
                ['ADC', 'XADC — 153kHz sample rate, 12-bit resolution'],
                ['CIC Decimation Filter', 'R=627, 244Hz output rate'],
                ['FIR Low-Pass Filter', '15-tap, 20Hz cutoff, Hann window'],
                ['UART Frame', '8 bytes @ 115200 baud, CRC-8 check'],
                ['Gateway Hardware', 'Raspberry Pi 4 (4GB RAM)'],
                ['Gateway Software', 'Node.js v20, WebSocket server'],
                ['Frontend', 'Vite + React 18, Tailwind CSS v3'],
                ['Map Engine', 'MapLibre GL JS via @vis.gl/react-maplibre'],
                ['Tile Source', 'OpenFreeMap (liberty style)'],
                ['Sensor Sampling Rate', '244 Hz post-decimation'],
                ['Detection Threshold', 'Sub-20Hz, amplitude > 0.85 normalized'],
                ['Lead Time vs USGS', '0.3 – 1.2 seconds (preliminary)'],
              ].map(([label, value], i) => (
                <tr
                  key={label}
                  className="border-b border-[#f1f5f9]"
                  style={{ background: i % 2 === 0 ? '#ffffff' : '#fafbfc' }}
                >
                  <td
                    className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#64748b] w-48"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", borderRight: '1px solid #f1f5f9', letterSpacing: '0.08em' }}
                  >
                    {label}
                  </td>
                  <td
                    className="px-4 py-2.5 text-[12px] text-[#0f172a]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p
          className="text-[10px] text-[#94a3b8] mt-6 text-center"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          SENTINEL v1.0 — 2026 IEEE Response Quest Challenge — NODE-01 Sub-20Hz FPGA Early Warning System
        </p>
      </div>
    </div>
  )
}
