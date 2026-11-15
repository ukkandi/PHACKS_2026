import { describe, expect, it } from 'vitest'
import { triage } from './triage'
import type { CareEntry } from './wardenDb'
import { demoRoster } from '../sim/demoRounds'

const care = (unit: string, tick: number, okay: boolean, symptoms: CareEntry['symptoms'] = [], mood = 3): CareEntry => ({
  type: 'care', level: 38, unit, okay, symptoms, mood, tick, via: 'terminal', receivedAt: 0,
})

describe('triage', () => {
  it('puts a vulnerable resident asking for help with breathing trouble first', () => {
    const rows = triage(demoRoster(38), [care('38-221', 10, false, ['breathing']), care('38-117', 10, true)], 12)
    expect(rows[0].unit).toBe('38-221')
    expect(rows[0].status).toBe('needs-help')
    expect(rows[0].reasons).toEqual(expect.arrayContaining(['asked for help', 'breathing trouble', 'vulnerable']))
  })
  it('flags vulnerable people who have not checked in', () => {
    const rows = triage(demoRoster(38), [care('38-221', 10, true), care('38-117', 10, true), care('38-402', 10, true)], 12)
    expect(rows[0]).toMatchObject({ unit: '38-305', status: 'missing' })
  })
  it('a visit clears the help request', () => {
    const roster = demoRoster(38).map((r) => (r.unit === '38-221' ? { ...r, visitedTick: 11 } : r))
    const rows = triage(roster, [care('38-221', 10, false)], 12)
    expect(rows.find((r) => r.unit === '38-221')!.reasons).not.toContain('asked for help')
  })
  it('includes units not on the roster (e.g. phone users asking for help)', () => {
    const rows = triage([], [{ ...care('38-114', 10, false), name: 'Mara' }], 12)
    expect(rows[0]).toMatchObject({ unit: '38-114', name: 'Mara', status: 'needs-help' })
  })
})
