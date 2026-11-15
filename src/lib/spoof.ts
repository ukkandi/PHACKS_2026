// SIMULATED ATTACK, for the trust demo: a single rogue device floods a level with fake symptom
// reports (e.g. to trigger a panic, or to discredit the ledger). The ledger should hold it back.
import { MeshNode } from './mesh'
import { ZERO_COUNTS } from './reports'

export function injectFakeReports(level: number, tick: number, netUp: boolean) {
  const node = new MeshNode({ getInfo: () => ({ nodeId: `rogue-${Math.random().toString(36).slice(2, 6)}`, level, netUp }), relay: false })
  const n = 300
  node.send({
    kind: 'summary',
    level,
    tick,
    source: 'unknown',
    counts: { ...ZERO_COUNTS, reports: n, okay: n, symptomatic: 290, fever: 290, moodSum: n * 3, sleepSum: n * 7 },
  })
  setTimeout(() => node.close(), 1000)
}
