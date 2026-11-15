import { describe, expect, it } from 'vitest'
import { simulatedBallot } from '../sim/votes'
import { createWorld } from '../sim/world'
import { tallyVotes } from './votes'

describe('tallyVotes (Borda)', () => {
  it('orders by points and counts each level once (latest round)', () => {
    const t = tallyVotes([
      { level: 1, round: 0, ranking: ['light', 'cooling', 'water', 'air'] },
      { level: 1, round: 1, ranking: ['water', 'air', 'cooling', 'light'] },
      { level: 2, round: 1, ranking: ['air', 'water', 'cooling', 'light'] },
      { level: 3, round: 1, ranking: ['water', 'air', 'light', 'cooling'] },
    ])
    expect(t.voters).toBe(3)
    expect(t.order).toEqual(['water', 'air', 'cooling', 'light'])
    expect(t.points.water).toBe(8)
    expect(t.round).toBe(1)
  })
  it('ignores malformed ballots and defaults when nobody voted', () => {
    expect(tallyVotes([{ level: 1, round: 0, ranking: ['air', 'air', 'air', 'air'] }]).voters).toBe(0)
    expect(tallyVotes([]).order).toEqual(['air', 'water', 'cooling', 'light'])
  })
})

describe('simulated ballots', () => {
  it('are deterministic and give a sensible community result', () => {
    const w = createWorld()
    const ballots = w.levels.map((l) => simulatedBallot(w.seed, l, 0))
    expect(ballots).toEqual(w.levels.map((l) => simulatedBallot(w.seed, l, 0)))
    const t = tallyVotes(ballots)
    expect(t.voters).toBe(40)
    expect(t.order[0]).toBe('air')
    expect(t.order[3]).toBe('light')
  })
})
