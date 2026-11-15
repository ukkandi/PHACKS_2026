// SIMULATED: how each level's residents rank the priorities. Deterministic per (seed, level, day).
// Everyone tends to put air first; deep, hot levels push cooling up; upper levels care more about water.
import type { Purpose } from '../lib/allocation'
import type { Ballot } from '../lib/votes'
import { Rng } from './rng'
import type { LevelState } from './types'

export function simulatedBallot(seed: number, l: LevelState, round: number): Ballot {
  const rng = new Rng((seed * 7919 + l.level * 104729 + round * 1299709) >>> 0)
  const depth = (l.level - 1) / 39
  const score: Record<Purpose, number> = {
    air: 4 + rng.noise(1.6) + (l.blackout ? 1 : 0),
    water: 3 + (depth < 0.4 ? 0.8 : 0) + (l.waterQuality < 70 ? 1.5 : 0) + rng.noise(1.6),
    cooling: 1.6 + depth * 2.4 + rng.noise(1.6),
    light: 1 + (l.blackout ? 0.6 : 0) + rng.noise(1.6),
  }
  const ranking = (Object.keys(score) as Purpose[]).sort((a, b) => score[b] - score[a])
  return { level: l.level, ranking, round }
}
