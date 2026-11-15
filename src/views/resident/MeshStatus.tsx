import { Badge } from '../../components/ui'
import type { World } from '../../sim/types'
import { isNetworkUp } from '../../sim/world'
import { useFamily } from '../../stores/familyStore'

/** How this device is currently connected. */
export function MeshStatus({ world, level }: { world: World | null; level: number }) {
  const neighbours = useFamily((s) => s.neighbours)
  const running = useFamily((s) => s.running)
  const radio = Object.values(neighbours).filter((n) => n.link === 'radio').length
  const net = world ? isNetworkUp(world, level) : true
  if (!running) return <Badge tone="muted">mesh starting…</Badge>
  return net ? (
    <Badge tone="ok">Online · Directorate net + mesh</Badge>
  ) : (
    <Badge tone={radio > 0 ? 'warn' : 'danger'}>
      Mesh only · {radio} device{radio === 1 ? '' : 's'} in radio range
    </Badge>
  )
}
