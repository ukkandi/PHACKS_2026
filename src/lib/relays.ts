// SIMULATED: "neighbour devices" — one Lantern phone per level, hosted in the /sim tab, that
// relay mesh traffic and broadcast blackout alerts for their level. In the real Hollow these are
// simply other residents' phones; without them the demo would need dozens of tabs.
import { AlertEmitter, alertForLevel } from './alerts'
import { MeshNode } from './mesh'
import { LEVEL_COUNT, type World } from '../sim/types'
import { isNetworkUp } from '../sim/world'

export interface RelayFleet {
  onWorld: (w: World) => void
  stop: () => void
}

export function startRelays(getWorld: () => World): RelayFleet {
  const emitter = new AlertEmitter()
  const nodes = Array.from({ length: LEVEL_COUNT }, (_, i) => {
    const level = i + 1
    return new MeshNode({
      getInfo: () => ({ nodeId: `neighbour-L${level}`, level, netUp: isNetworkUp(getWorld(), level) }),
    })
  })
  const onWorld = (w: World) => {
    nodes.forEach((node, i) => {
      const a = alertForLevel(w.levels[i], w.tick)
      if (emitter.shouldSend(a.level, a.band)) node.send(a)
    })
  }
  onWorld(getWorld())
  return { onWorld, stop: () => nodes.forEach((n) => n.close()) }
}
