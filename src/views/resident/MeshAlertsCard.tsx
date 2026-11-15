import { Card, StateTag, Trust } from '../../components/ui'
import { hopCount } from '../../lib/mesh'
import { ago } from '../../lib/status'
import { useFamily } from '../../stores/familyStore'
import { formatHoursRange } from '../../sim/predict'

/** Public blackout alerts that reached this device over the mesh from other levels. */
export function MeshAlertsCard() {
  const alerts = useFamily((s) => s.alerts)
  const members = useFamily((s) => s.members)
  const familyLevels = new Set(Object.values(members).map((m) => m.level))
  const active = Object.values(alerts)
    .filter((a) => a.band !== 'clear')
    .sort((a, b) => Number(familyLevels.has(b.level)) - Number(familyLevels.has(a.level)) || b.riskPct - a.riskPct)

  return (
    <Card
      title="Other levels"
      help="Blackout alerts raised by phones on other levels, passed along the mesh. Family levels are listed first."
    >
      {active.length === 0 ? (
        <StateTag state="normal">No alerts heard</StateTag>
      ) : (
        <ul className="space-y-2">
          {active.map((a) => (
            <li key={a.level}>
              <div className="flex flex-wrap items-center gap-3">
                <StateTag state={a.band === 'warning' ? 'watch' : 'danger'}>
                  L{a.level} · {a.band === 'blackout' ? 'blackout' : `risk · ${formatHoursRange(a.hoursRange)}`}
                </StateTag>
                {familyLevels.has(a.level) && <span className="font-mono text-sm text-lamp uppercase">family here</span>}
              </div>
              <Trust>
                Heard {ago(a.receivedAt)} · via {hopCount(a.route)} hops{a.band !== 'blackout' ? ` · ${a.confidence} conf.` : ''}
              </Trust>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
