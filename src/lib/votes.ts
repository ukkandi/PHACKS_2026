// Community-set priorities: each level submits a ranked ballot; the network tallies them with a
// Borda count (1st place = 3 points … 4th = 0). Pure and recomputable by anyone from the ballots.
import { DEFAULT_PRIORITIES, type Purpose } from './allocation'

export interface Ballot {
  level: number
  ranking: Purpose[]
  /** Voting round (one per simulated day). */
  round: number
}

export interface Tally {
  order: Purpose[]
  points: Record<Purpose, number>
  voters: number
  round: number | null
}

export function isValidRanking(r: Purpose[]): boolean {
  return r.length === DEFAULT_PRIORITIES.length && DEFAULT_PRIORITIES.every((p) => r.includes(p))
}

/** Only each level's latest valid ballot counts. */
export function tallyVotes(ballots: Ballot[]): Tally {
  const latest = new Map<number, Ballot>()
  for (const b of ballots) {
    if (!isValidRanking(b.ranking)) continue
    const cur = latest.get(b.level)
    if (!cur || b.round > cur.round) latest.set(b.level, b)
  }
  const points = Object.fromEntries(DEFAULT_PRIORITIES.map((p) => [p, 0])) as Record<Purpose, number>
  for (const b of latest.values()) b.ranking.forEach((p, i) => (points[p] += b.ranking.length - 1 - i))
  if (latest.size === 0) return { order: DEFAULT_PRIORITIES, points, voters: 0, round: null }
  const order = [...DEFAULT_PRIORITIES].sort(
    (a, b) => points[b] - points[a] || DEFAULT_PRIORITIES.indexOf(a) - DEFAULT_PRIORITIES.indexOf(b),
  )
  return { order, points, voters: latest.size, round: Math.max(...[...latest.values()].map((b) => b.round)) }
}
