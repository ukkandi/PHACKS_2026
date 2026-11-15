import { describe, expect, it } from 'vitest'
import { recommendAllocation, type LevelNeedInput } from './allocation'
import { detectOutbreak, median } from './outbreak'
import { countsAreConsistent } from './reports'
import { directorateBulletin, ACK_DELAY } from '../sim/directorate'
import { standInCounts } from '../sim/standin'
import { applyAction, createWorld, tickWorld } from '../sim/world'

describe('detectOutbreak', () => {
  it('flags a big, well-sampled jump over baseline', () => {
    const r = detectOutbreak({ n: 80, k: 14 }, { n: 300, k: 15 }, 0.04)
    expect(r.status).toBe('outbreak')
    expect(r.baselineSource).toBe('history')
  })
  it('stays quiet within noise', () => {
    expect(detectOutbreak({ n: 80, k: 5 }, { n: 300, k: 15 }, 0.04).status).toBe('normal')
  })
  it('refuses to judge on too few reports', () => {
    expect(detectOutbreak({ n: 5, k: 4 }, null, 0.04).status).toBe('insufficient')
  })
  it('falls back to the Hollow-wide median without history', () => {
    const r = detectOutbreak({ n: 60, k: 12 }, null, 0.04)
    expect(r.baselineSource).toBe('hollow-median')
    expect(r.status).toBe('outbreak')
  })
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
})

const lvl = (o: Partial<LevelNeedInput> & { level: number }): LevelNeedInput => ({
  population: 50_000_000,
  powerOut: false,
  air: 85,
  temperature: 30,
  waterBadShare: 0.02,
  outbreak: false,
  ...o,
})

describe('recommendAllocation', () => {
  it('nothing needed → nothing allocated', () => {
    expect(recommendAllocation([lvl({ level: 5 }), lvl({ level: 20 })], 14).allocations).toHaveLength(0)
  })
  it('a blacked-out deep level gets air first, ahead of light', () => {
    const plan = recommendAllocation([lvl({ level: 38, powerOut: true, air: 62, temperature: 44 }), lvl({ level: 3 })], 14)
    expect(plan.allocations[0]).toMatchObject({ level: 38, purpose: 'air' })
    expect(plan.allocations.map((a) => a.purpose)).toEqual(['air', 'cooling', 'light'])
    expect(plan.allocations[0].reason).toContain('Priority #1')
  })
  it('respects the reserve and reports what is unmet', () => {
    const levels = [36, 37, 38, 39].map((level) => lvl({ level, powerOut: true, air: 55, temperature: 46 }))
    const plan = recommendAllocation(levels, 10)
    expect(plan.allocations.reduce((a, x) => a + x.mw, 0)).toBeLessThanOrEqual(10.01)
    expect(plan.unmet.length).toBeGreaterThan(0)
  })
  it('community can reorder priorities', () => {
    const levels = [lvl({ level: 10, waterBadShare: 0.6 }), lvl({ level: 38, powerOut: true, air: 70 })]
    const waterFirst = recommendAllocation(levels, 2, ['water', 'air', 'cooling', 'light'])
    expect(waterFirst.allocations[0].purpose).toBe('water')
  })
})

describe('directorate bulletin (simulated)', () => {
  it('under-reports an outbreak and admits blackouts late', () => {
    let w = applyAction(createWorld(), { type: 'symptomSpike', levels: [38] })
    w = applyAction(w, { type: 'blackout', level: 38 })
    for (let i = 0; i < 6; i++) w = tickWorld(w)
    const b = directorateBulletin(w)
    expect(b.levels[37].symptomRate).toBeLessThan(w.levels[37].symptomRate * 0.6)
    expect(b.levels[37].power).toBe('planned maintenance')
    expect(b.allocations.some((a) => a.purpose === 'administration')).toBe(true)
    const early = directorateBulletin(applyAction(createWorld(), { type: 'blackout', level: 38 }))
    expect(early.levels[37].power).toBe('normal')
    expect(ACK_DELAY).toBeGreaterThan(0)
  })
})

describe('stand-in reports (simulated)', () => {
  it('are consistent and reflect the outbreak', () => {
    let w = createWorld()
    const before = standInCounts(w, w.levels[37], 24)
    w = applyAction(w, { type: 'symptomSpike', levels: [38] })
    for (let i = 0; i < 4; i++) w = tickWorld(w)
    const after = standInCounts(w, w.levels[37], 24)
    expect(countsAreConsistent(before)).toBe(true)
    expect(countsAreConsistent(after)).toBe(true)
    expect(after.symptomatic / after.reports).toBeGreaterThan((before.symptomatic / before.reports) * 2)
  })
})
