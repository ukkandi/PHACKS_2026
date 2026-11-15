import { describe, expect, it } from 'vitest'
import { anomalyReason, buildLedger, type StoredSummary } from './ledger'
import { ZERO_COUNTS, type ReportCounts } from './reports'

let seq = 0
function batch(level: number, tick: number, n: number, sick: number, source: StoredSummary['source'] = 'standin'): StoredSummary {
  const counts: ReportCounts = { ...ZERO_COUNTS, reports: n, okay: n, symptomatic: sick, fever: sick, moodSum: n * 3, sleepSum: n * 7 }
  return { kind: 'summary', id: `s${seq++}`, level, tick, source, counts, receivedAt: 0, hops: 1 }
}

describe('buildLedger', () => {
  it('counts reports per level in the window and flags an outbreak', () => {
    const s: StoredSummary[] = []
    for (let level = 1; level <= 40; level++) for (const t of [90, 93, 96, 99]) s.push(batch(level, t, 20, 1))
    for (const t of [90, 93, 96, 99]) s.push(batch(38, t, 20, 4)) // extra sick batches on L38
    const v = buildLedger(s, {}, [], 100)
    expect(v.levels[0].reports).toBe(80)
    expect(v.levels[37].reports).toBe(160)
    expect(v.levels[37].outbreak.status).toBe('outbreak')
    expect(v.levels[0].outbreak.status).toBe('normal')
  })

  it('ignores reports outside the window for current figures', () => {
    const v = buildLedger([batch(5, 50, 30, 0)], {}, [], 100)
    expect(v.levels[4].reports).toBe(0)
  })

  it('holds back a spoofed batch until a warden confirms', () => {
    const spoof = { ...batch(5, 99, 300, 290), source: 'unknown' as const }
    expect(anomalyReason(spoof)).toBeTruthy()
    const held = buildLedger([spoof], {}, [], 100)
    expect(held.levels[4].reports).toBe(0)
    expect(held.levels[4].heldBack).toHaveLength(1)
  })

  it('a personal check-in counting many reports is anomalous', () => {
    expect(anomalyReason({ ...batch(5, 99, 5, 0), source: 'resident' })).toBeTruthy()
    expect(anomalyReason({ ...batch(5, 99, 1, 0), source: 'resident' })).toBeNull()
  })
})
