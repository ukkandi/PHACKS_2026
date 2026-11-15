import { Badge, Card } from '../../components/ui'
import { timeAgo } from '../../lib/format'
import { hopCount } from '../../lib/mesh'
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
    <Card title="Alerts from other levels">
      {active.length === 0 ? (
        <p className="text-sm text-hollow-500">No blackout alerts heard on the mesh.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((a) => (
            <li key={a.level} className="text-sm">
              <div className="flex items-center gap-2">
                <Badge tone={a.band === 'warning' ? 'warn' : 'danger'}>L{a.level}</Badge>
                <span>
                  {a.band === 'blackout'
                    ? 'Blackout in progress'
                    : `Blackout risk ${a.riskPct}%${a.hoursRange ? `, in ${formatHoursRange(a.hoursRange)} (${a.confidence} confidence)` : ''}`}
                </span>
                {familyLevels.has(a.level) && <Badge tone="lamp">family here</Badge>}
              </div>
              <div className="font-mono text-[11px] text-hollow-500">
                heard {timeAgo(a.receivedAt)} · {hopCount(a.route)} hops
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
