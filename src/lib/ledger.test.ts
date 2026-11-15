import { describe, expect, it } from 'vitest'
import { anomalyReason, buildLedger, mergeAlerts, mergeSummaries, type StoredSummary } from './ledger'
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
    expect(anomalyReason({ ...batch(5, 99, 150, 5), hours: 12 })).toBeNull() // 12h level-phone backfill is fine
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

describe('catch-up merging', () => {
  it('is order-independent and ignores duplicates', () => {
    const a = batch(5, 10, 20, 1)
    const b = batch(6, 11, 20, 1)
    const one = mergeSummaries(mergeSummaries([], [a], 12, 0), [b, a], 12, 0)
    const two = mergeSummaries(mergeSummaries([], [b], 12, 0), [a, b], 12, 0)
    expect(one.map((s) => s.id).sort()).toEqual(two.map((s) => s.id).sort())
    expect(one).toHaveLength(2)
  })
  it('drops reports outside the window or from a reset world', () => {
    expect(mergeSummaries([], [batch(5, 1, 20, 1), batch(5, 50, 20, 1)], 100, 0)).toHaveLength(1) // tick 1 too old
    expect(mergeSummaries([], [batch(5, 120, 20, 1)], 100, 0)).toHaveLength(0) // future tick
  })
  it('keeps the newest alert per level', () => {
    const base = { kind: 'alert' as const, level: 38, riskPct: 0, hoursToFailure: null, hoursRange: null, confidence: 'low' as const, reason: '' }
    const m = mergeAlerts({}, [{ ...base, band: 'blackout', tick: 20 }, { ...base, band: 'warning', tick: 10 }], 0)
    expect(m[38].band).toBe('blackout')
  })
})
