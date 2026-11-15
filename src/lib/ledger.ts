// The public ledger: turns anonymous mesh summaries into per-level numbers anyone can recompute.
// Pure functions only; the ledger store feeds them packets.
import type { AlertBody, LevelConditions, ReportSource, SummaryBody, VerifyBody } from './mesh'
import { detectOutbreak, median, type OutbreakResult, type Tally } from './outbreak'
import { addCounts, countsAreConsistent, ZERO_COUNTS, type ReportCounts } from './reports'
import { LEVEL_COUNT } from '../sim/types'

export interface StoredSummary extends SummaryBody {
  id: string
  receivedAt: number
  hops: number
}

export interface StoredVerify extends VerifyBody {
  id: string
  receivedAt: number
}

export interface StoredAlert extends AlertBody {
  receivedAt: number
}

/** "Current" window for every figure on the ledger, in simulated hours. */
export const WINDOW = 12
/** Baseline window: hours [now - BASELINE_FROM, now - WINDOW). */
export const BASELINE_FROM = 72
/** Most check-ins one device can plausibly have collected per hour (a level phone batching its neighbours). */
export const MAX_PER_HOUR = 25

export type Confidence = 'low' | 'medium' | 'high'

export interface LevelView {
  level: number
  /** Reports behind this level's numbers (current window, accepted only). */
  reports: number
  bySource: Partial<Record<ReportSource, number>>
  counts: ReportCounts
  outbreak: OutbreakResult
  waterBadShare: number
  lowMoodShare: number
  shortSleepShare: number
  avgMood: number
  avgSleep: number
  conditions: (LevelConditions & { tick: number }) | null
  alert: StoredAlert | null
  confidence: Confidence
  verifications: StoredVerify[]
  /** Summaries held back as anomalous (not counted unless a warden confirms the level's reports). */
  heldBack: { summary: StoredSummary; why: string }[]
}

export interface LedgerView {
  tick: number
  levels: LevelView[]
  hollowMedianRate: number
  totalReports: number
  levelsReporting: number
}

/**
 * Merge incoming summaries into a ledger copy: skip ids we already hold, keep only the rolling
 * window, and drop anything from a future tick (the world was reset). Pure; order-independent.
 */
export function mergeSummaries(
  existing: StoredSummary[],
  incoming: (SummaryBody & { id: string; hops?: number })[],
  tick: number,
  now: number,
): StoredSummary[] {
  const have = new Set(existing.map((s) => s.id))
  const added: StoredSummary[] = []
  for (const s of incoming) {
    if (have.has(s.id)) continue
    have.add(s.id)
    added.push({ ...s, receivedAt: now, hops: s.hops ?? 0 })
  }
  if (!added.length) return existing
  return [...existing, ...added].filter((s) => s.tick <= tick && tick - s.tick < BASELINE_FROM)
}

/** Keep the newest alert per level (by tick). */
export function mergeAlerts(existing: Record<number, StoredAlert>, incoming: AlertBody[], now: number): Record<number, StoredAlert> {
  const out = { ...existing }
  for (const a of incoming) {
    const cur = out[a.level]
    if (!cur || a.tick >= cur.tick) out[a.level] = { ...a, receivedAt: now }
  }
  return out
}

export function mergeVerifies(existing: StoredVerify[], incoming: (VerifyBody & { id: string })[], now: number): StoredVerify[] {
  const have = new Set(existing.map((v) => v.id))
  const added = incoming.filter((v) => !have.has(v.id)).map((v) => ({ ...v, receivedAt: now }))
  return added.length ? [...existing, ...added].slice(-200) : existing
}

/** Why a summary looks wrong, or null if it looks fine. */
export function anomalyReason(s: SummaryBody): string | null {
  if (!countsAreConsistent(s.counts)) return 'Counts are internally inconsistent.'
  if (s.source === 'unknown') return 'Sender did not identify as a resident, terminal, warden or level phone.'
  const max = MAX_PER_HOUR * Math.min(24, Math.max(1, s.hours ?? 1))
  if (s.counts.reports > max) return `${s.counts.reports} reports in one packet from a single device (max ${max}).`
  if ((s.source === 'resident' || s.source === 'terminal' || s.source === 'warden') && s.counts.reports !== 1)
    return 'A personal check-in must count exactly one report.'
  return null
}

const share = (k: number, n: number) => (n > 0 ? k / n : 0)

export function buildLedger(
  summaries: StoredSummary[],
  alerts: Record<number, StoredAlert>,
  verifies: StoredVerify[],
  tick: number,
): LedgerView {
  const per = Array.from({ length: LEVEL_COUNT }, () => ({
    cur: { ...ZERO_COUNTS },
    base: { n: 0, k: 0 } as Tally,
    bySource: {} as Partial<Record<ReportSource, number>>,
    conditions: null as (LevelConditions & { tick: number }) | null,
    held: [] as { summary: StoredSummary; why: string }[],
  }))
  const confirmedReports = new Set(
    verifies.filter((v) => v.claim === 'reports' && v.confirmed && v.tick >= tick - WINDOW).map((v) => v.level),
  )

  for (const s of summaries) {
    const p = per[s.level - 1]
    if (!p) continue
    const age = tick - s.tick
    if (age < 0 || age >= BASELINE_FROM) continue
    if (s.conditions && (!p.conditions || s.tick >= p.conditions.tick)) p.conditions = { ...s.conditions, tick: s.tick }
    const why = anomalyReason(s)
    if (why && !(confirmedReports.has(s.level) && countsAreConsistent(s.counts))) {
      if (age < WINDOW) p.held.push({ summary: s, why })
      continue
    }
    if (age < WINDOW) {
      p.cur = addCounts(p.cur, s.counts)
      p.bySource[s.source] = (p.bySource[s.source] ?? 0) + s.counts.reports
    } else {
      p.base.n += s.counts.reports
      p.base.k += s.counts.symptomatic
    }
  }

  const rates = per.filter((p) => p.cur.reports >= 20).map((p) => p.cur.symptomatic / p.cur.reports)
  const hollowMedianRate = median(rates)

  const levels: LevelView[] = per.map((p, i) => {
    const level = i + 1
    const c = p.cur
    const vs = verifies.filter((v) => v.level === level && v.tick >= tick - BASELINE_FROM).sort((a, b) => b.tick - a.tick)
    const sourceKinds = Object.keys(p.bySource).length
    const wardenBacked = vs.some((v) => v.confirmed) || (p.bySource.warden ?? 0) > 0
    const confidence: Confidence =
      c.reports >= 60 && (sourceKinds >= 2 || wardenBacked) ? 'high' : c.reports >= 20 ? 'medium' : 'low'
    return {
      level,
      reports: c.reports,
      bySource: p.bySource,
      counts: c,
      outbreak: detectOutbreak({ n: c.reports, k: c.symptomatic }, p.base.n ? p.base : null, hollowMedianRate),
      waterBadShare: share(c.waterBad, c.reports),
      lowMoodShare: share(c.lowMood, c.reports),
      shortSleepShare: share(c.shortSleep, c.reports),
      avgMood: share(c.moodSum, c.reports),
      avgSleep: share(c.sleepSum, c.reports),
      conditions: p.conditions,
      alert: alerts[level] ?? null,
      confidence,
      verifications: vs,
      heldBack: p.held,
    }
  })

  return {
    tick,
    levels,
    hollowMedianRate,
    totalReports: levels.reduce((a, l) => a + l.reports, 0),
    levelsReporting: levels.filter((l) => l.reports > 0).length,
  }
}

/** Shares for a band of levels (e.g. upper vs deep), weighted by reports. */
export function bandStats(levels: LevelView[], from: number, to: number) {
  const sel = levels.filter((l) => l.level >= from && l.level <= to)
  const n = sel.reduce((a, l) => a + l.reports, 0)
  const sum = (f: (c: ReportCounts) => number) => sel.reduce((a, l) => a + f(l.counts), 0)
  return {
    reports: n,
    lowMood: share(sum((c) => c.lowMood), n),
    shortSleep: share(sum((c) => c.shortSleep), n),
    avgMood: share(sum((c) => c.moodSum), n),
    avgSleep: share(sum((c) => c.sleepSum), n),
  }
}
