// SIMULATED: "neighbour devices" — one Lantern phone per level, hosted in the World Simulator tab.
// Each relays mesh traffic, broadcasts blackout alerts for its level, and every few hours sends an
// anonymous batch of its neighbours' coarse check-in counts plus the level's public meter readings.
// In the real Hollow these are simply other residents' phones; without them the demo would need
// thousands of tabs.
import { AlertEmitter, alertForLevel } from './alerts'
import { MeshNode } from './mesh'
import { LEVEL_COUNT, type World } from '../sim/types'
import { isNetworkUp } from '../sim/world'
import { STANDIN_EVERY, standInCounts, standInDue } from '../sim/standin'

export interface RelayFleet {
  onWorld: (w: World) => void
  stop: () => void
}

export function startRelays(getWorld: () => World): RelayFleet {
  const emitter = new AlertEmitter()
  let lastTick = -1
  const nodes = Array.from({ length: LEVEL_COUNT }, (_, i) => {
    const level = i + 1
    return new MeshNode({
      getInfo: () => ({ nodeId: `neighbour-L${level}`, level, netUp: isNetworkUp(getWorld(), level) }),
    })
  })
  const sendBatch = (node: MeshNode, w: World, i: number, hours: number, id: string) => {
    const l = w.levels[i]
    const counts = standInCounts(w, l, hours)
    if (counts.reports === 0) return
    node.send(
      {
        kind: 'summary',
        level: l.level,
        tick: w.tick,
        source: 'standin',
        counts,
        conditions: { temperature: l.temperature, air: l.airQuality, powerOut: l.blackout, population: l.population },
      },
      // Deterministic id: if the simulator reloads, re-sent batches are recognised as duplicates.
      { anonymous: true, id },
    )
  }
  const backfill = (w: World) => nodes.forEach((node, i) => sendBatch(node, w, i, 12, `standin-${w.seed}-L${i + 1}-backfill`))
  const onWorld = (w: World) => {
    const newHour = w.tick !== lastTick
    if (w.tick < lastTick) backfill(w) // world was reset
    lastTick = w.tick
    nodes.forEach((node, i) => {
      const l = w.levels[i]
      const a = alertForLevel(l, w.tick)
      if (emitter.shouldSend(a.level, a.band)) node.send(a)
      if (newHour && standInDue(w.tick, l.level)) sendBatch(node, w, i, STANDIN_EVERY, `standin-${w.seed}-L${l.level}-t${w.tick}`)
    })
  }
  // At the start of a fresh world, each level phone shares the last 12 hours it already holds.
  // (Not on a mid-run reload: ledgers already have those reports.)
  const w0 = getWorld()
  if (w0.tick === 0) backfill(w0)
  onWorld(w0)
  return { onWorld, stop: () => nodes.forEach((n) => n.close()) }
}
