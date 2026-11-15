// End-to-end (pure): world → stand-in level-phone batches → ledger → outbreak detector.
import { describe, expect, it } from 'vitest'
import { buildLedger, type StoredSummary } from './ledger'
import { STANDIN_EVERY, standInCounts, standInDue } from '../sim/standin'
import type { World } from '../sim/types'
import { applyAction, createWorld, tickWorld } from '../sim/world'

function batch(w: World, i: number, hours: number, id: string, tick = w.tick): StoredSummary {
  const l = w.levels[i]
  return { kind: 'summary', id, level: l.level, tick, source: 'standin', hours, counts: standInCounts(w, l, hours), receivedAt: 0, hops: 0 }
}

function run(hours: number, spikeAt?: number) {
  let w = createWorld()
  const s: StoredSummary[] = []
  w.levels.forEach((_, i) => {
    s.push(batch(w, i, 36, `h${i}`, -12))
    s.push(batch(w, i, 12, `b${i}`))
  })
  const flagged: { tick: number; outbreaks: number[] }[] = []
  for (let t = 1; t <= hours; t++) {
    if (t === spikeAt) w = applyAction(w, { type: 'symptomSpike', levels: [34, 35, 36, 37, 38, 39, 40] })
    w = tickWorld(w)
    w.levels.forEach((l, i) => {
      if (standInDue(w.tick, l.level)) s.push(batch(w, i, STANDIN_EVERY, `t${t}-${i}`))
    })
    if (t % 6 === 0) {
      const v = buildLedger(s, {}, [], w.tick)
      flagged.push({ tick: t, outbreaks: v.levels.filter((x) => x.outbreak.status === 'outbreak').map((x) => x.level) })
    }
  }
  return flagged
}

describe('outbreak pipeline', () => {
  it('a quiet Hollow raises no outbreak flags over three days', () => {
    expect(run(72).flatMap((f) => f.outbreaks)).toEqual([])
  })
  it('a spike on levels 34–40 is flagged on those levels within 8 hours', () => {
    const f = run(30, 20).find((x) => x.tick === 30)!
    expect(f.outbreaks.sort((a, b) => a - b)).toEqual([34, 35, 36, 37, 38, 39, 40])
  })
})
