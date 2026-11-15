// Outbreak detector: is a level's symptom rate significantly above its normal level?
// One-sided z-test of a proportion against a baseline. Pure and explainable.

export interface Tally {
  n: number
  k: number
}

export type OutbreakStatus = 'insufficient' | 'normal' | 'watch' | 'outbreak'

export interface OutbreakResult {
  status: OutbreakStatus
  rate: number
  baselineRate: number
  /** Where the baseline came from, for the explanation. */
  baselineSource: 'history' | 'hollow-median'
  z: number
  n: number
  reason: string
}

/** Need at least this many reports before saying anything. */
export const MIN_REPORTS = 20
export const OUTBREAK_Z = 3
export const WATCH_Z = 2

/** Reports needed before a level's own history is trusted as its baseline. */
export const MIN_BASELINE = 200
/** Pseudo-reports of the Hollow-wide rate mixed into a level's history (shrinkage against noise). */
const SHRINK = 100
/** Never test against a baseline below this: tiny baselines make any blip look like an outbreak. */
const FLOOR = 0.02

export function detectOutbreak(current: Tally, baseline: Tally | null, hollowMedianRate: number): OutbreakResult {
  const useHistory = baseline !== null && baseline.n >= MIN_BASELINE
  const prior = Math.max(FLOOR, hollowMedianRate)
  const p0 = Math.max(FLOOR, useHistory ? (baseline.k + SHRINK * prior) / (baseline.n + SHRINK) : prior)
  const baselineSource = useHistory ? 'history' : 'hollow-median'
  const n = current.n
  const rate = n > 0 ? current.k / n : 0
  if (n < MIN_REPORTS) {
    return { status: 'insufficient', rate, baselineRate: p0, baselineSource, z: 0, n, reason: `Only ${n} report${n === 1 ? "" : "s"} — not enough to tell.` }
  }
  const z = (rate - p0) / Math.sqrt((p0 * (1 - p0)) / n)
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  const vs = baselineSource === 'history' ? "this level's usual" : 'the Hollow-wide median'
  let status: OutbreakStatus = 'normal'
  if (z >= OUTBREAK_Z && rate >= p0 * 1.5) status = 'outbreak'
  else if (z >= WATCH_Z) status = 'watch'
  const reason =
    status === 'outbreak'
      ? `${pct(rate)} of ${n} recent reports have symptoms vs ${vs} ${pct(p0)} — far beyond chance (z=${z.toFixed(1)}).`
      : status === 'watch'
        ? `${pct(rate)} with symptoms vs ${vs} ${pct(p0)} — elevated, watching (z=${z.toFixed(1)}).`
        : `${pct(rate)} with symptoms, in line with ${vs} ${pct(p0)}.`
  return { status, rate, baselineRate: p0, baselineSource, z, n, reason }
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
