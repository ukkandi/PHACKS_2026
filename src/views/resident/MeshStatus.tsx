import { Trust } from '../../components/ui'
import { useOfflineReady } from '../../lib/useOfflineReady'
import type { World } from '../../sim/types'
import { isNetworkUp } from '../../sim/world'
import { useFamily } from '../../stores/familyStore'

/** Persistent trust indicators: how this device is connected, and whether it works offline. */
export function MeshStatus({ world, level }: { world: World | null; level: number }) {
  const neighbours = useFamily((s) => s.neighbours)
  const running = useFamily((s) => s.running)
  const offline = useOfflineReady()
  const radio = Object.values(neighbours).filter((n) => n.link === 'radio').length
  const net = world ? isNetworkUp(world, level) : true
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {!running ? (
        <Trust tone="muted">Connecting</Trust>
      ) : net ? (
        <Trust>Network: normal</Trust>
      ) : (
        <Trust tone={radio > 0 ? 'warn' : 'danger'}>
          Network down · through neighbors' phones · {radio} nearby
        </Trust>
      )}
      <Trust tone={offline ? 'ok' : 'muted'}>{offline ? 'Works offline' : 'Not saved for offline yet'}</Trust>
    </span>
  )
}
