import { Dashboard } from './Dashboard'

export function ResponderView({ telemetry, storms }) {
  return <Dashboard telemetry={telemetry} storms={storms} />
}
