import { Badge, Card, SimTag } from '../../components/ui'
import type { World } from '../../sim/types'
import { isNetworkUp } from '../../sim/world'

/**
 * What this device can sense about its own level.
 * SIMULATED: readings come from the /sim world feed, standing in for the level's public meters.
 * The resident view only ever reads its OWN level from the feed; other levels arrive via the mesh.
 */
export function LocalConditions({ world, level }: { world: World | null; level: number }) {
  if (!world) {
    return (
      <Card title={`Level ${level}`}>
        <p className="text-sm text-hollow-300">No level meter readings yet. Open /sim to start the world.</p>
      </Card>
    )
  }
  const l = world.levels[level - 1]
  const net = isNetworkUp(world, level)
  return (
    <Card title={`Level ${level} right now`} right={<SimTag>meter feed</SimTag>}>
      <div className="flex flex-wrap gap-2 text-sm">
        {l.blackout ? <Badge tone="danger">Power out</Badge> : <Badge tone="ok">Power on</Badge>}
        <Badge tone={net ? 'ok' : 'danger'}>{net ? 'Directorate net up' : 'Directorate net DOWN'}</Badge>
        <Badge tone={l.temperature > 44 ? 'danger' : l.temperature > 38 ? 'warn' : 'muted'}>{l.temperature.toFixed(1)} °C</Badge>
        <Badge tone={l.airQuality < 65 ? 'danger' : 'muted'}>Air {Math.round(l.airQuality)}</Badge>
      </div>
    </Card>
  )
}
