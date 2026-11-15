import { describe, expect, it } from 'vitest'
import { predictBlackout } from './predict'
import { applyAction, createWorld, isNetworkUp, tickWorld } from './world'

const run = (w: ReturnType<typeof createWorld>, n: number) => {
  for (let i = 0; i < n; i++) w = tickWorld(w)
  return w
}

describe('world sim', () => {
  it('is deterministic for a seed', () => {
    expect(run(createWorld(7), 30)).toEqual(run(createWorld(7), 30))
  })

  it('has 40 levels, deeper is hotter', () => {
    const w = createWorld()
    expect(w.levels).toHaveLength(40)
    expect(w.levels[39].temperature).toBeGreaterThan(w.levels[0].temperature + 15)
  })

  it('symptom rates start at steady state (no drift in a quiet day)', () => {
    const w0 = createWorld()
    const w = run(w0, 24)
    for (let i = 0; i < 40; i++) expect(Math.abs(w.levels[i].symptomRate - w0.levels[i].symptomRate)).toBeLessThan(0.02)
  })

  it('no blackouts in a quiet day', () => {
    const w = run(createWorld(), 48)
    expect(w.levels.filter((l) => l.blackout)).toHaveLength(0)
  })

  it('no false blackout warnings across 3 quiet days', () => {
    let w = createWorld()
    let max = 0
    for (let i = 0; i < 72; i++) {
      w = tickWorld(w)
      for (const l of w.levels) max = Math.max(max, predictBlackout(l.loadHistory, { temperature: l.temperature }).riskPct)
    }
    expect(max).toBeLessThan(50)
  })

  it('the predicted window brackets the real failure time once confidence is high', () => {
    for (const start of [0, 9, 17]) {
      let w = createWorld()
      for (let i = 0; i < start; i++) w = tickWorld(w)
      w = applyAction(w, { type: 'surge', level: 38 })
      const preds: { tick: number; lo: number; hi: number | null }[] = []
      while (!w.levels[37].blackout && w.tick < start + 40) {
        w = tickWorld(w)
        const l = w.levels[37]
        if (l.blackout) break
        const p = predictBlackout(l.loadHistory, { temperature: l.temperature })
        if (p.confidence === 'high' && p.hoursRange) preds.push({ tick: w.tick, lo: p.hoursRange[0], hi: p.hoursRange[1] })
      }
      const failAt = w.tick
      expect(preds.length).toBeGreaterThan(0)
      // Allow 1h slack either side for hourly ticks.
      const hits = preds.filter((p) => failAt - p.tick >= Math.floor(p.lo) - 1 && (p.hi === null || failAt - p.tick <= Math.ceil(p.hi) + 1))
      expect(hits.length / preds.length).toBeGreaterThanOrEqual(0.8)
    }
  })

  it('a surge on L38 is predicted hours ahead, then trips the feeder and drops the network', () => {
    let w = applyAction(createWorld(), { type: 'surge', level: 38 })
    let warnedAt: number | null = null
    let blackoutAt: number | null = null
    for (let i = 0; i < 40 && blackoutAt === null; i++) {
      w = tickWorld(w)
      const l = w.levels[37]
      if (l.blackout) blackoutAt = w.tick
      else if (warnedAt === null && predictBlackout(l.loadHistory, { temperature: l.temperature }).riskPct >= 50)
        warnedAt = w.tick
    }
    expect(blackoutAt).not.toBeNull()
    expect(warnedAt).not.toBeNull()
    expect(blackoutAt! - warnedAt!).toBeGreaterThanOrEqual(3)
    expect(isNetworkUp(w, 38)).toBe(false)
    expect(isNetworkUp(w, 12)).toBe(true)

    w = applyAction(w, { type: 'restore', level: 38 })
    expect(isNetworkUp(w, 38)).toBe(true)
  })

  it('global outage takes every level offline', () => {
    const w = applyAction(createWorld(), { type: 'globalNetwork', down: true })
    expect(isNetworkUp(w, 1)).toBe(false)
  })
})
