// Blackout predictor: pure functions over a level's utilisation history (load / capacity).
// Simple and explainable on purpose: linear trend over recent hours + current headroom + heat.

export interface BlackoutPrediction {
  /** 0–100 */
  riskPct: number
  /** Hours until utilisation is projected to reach 100%. null = not trending toward failure. */
  hoursToFailure: number | null
  /** Change in utilisation per hour (fraction of capacity). */
  trendPerHour: number
  utilisation: number
  /**
   * Plausible window for the failure, [soonest, latest] hours. `latest` is null when the trend is
   * too weak to bound (we can only say "not before X"). null when no failure is projected.
   */
  hoursRange: [number, number | null] | null
  /** How much to trust the ETA: based on how well a straight line fits the recent readings. */
  confidence: Confidence
  /** Plain-language explanation for residents. */
  reason: string
}

export type Confidence = 'low' | 'medium' | 'high'

/** Standard error of the least-squares slope (0 when the fit is exact or n < 3). */
export function slopeStdErr(ys: number[]): number {
  const n = ys.length
  if (n < 3) return 0
  const b = slope(ys)
  const meanX = (n - 1) / 2
  const meanY = ys.reduce((a, c) => a + c, 0) / n
  let ss = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    const fit = meanY + b * (i - meanX)
    ss += (ys[i] - fit) ** 2
    sxx += (i - meanX) ** 2
  }
  return Math.sqrt(ss / (n - 2) / sxx)
}

/** Least-squares slope of y over x = 0..n-1. */
export function slope(ys: number[]): number {
  const n = ys.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (ys[i] - meanY)
    den += (i - meanX) ** 2
  }
  return num / den
}

export const TREND_WINDOW = 6
/** Forecast horizon: failures further away than this don't raise risk via the trend term. */
export const HORIZON_HOURS = 24

const logistic = (x: number) => 1 / (1 + Math.exp(-x))

/** Hours in a day: the predictor compares each reading with the same hour yesterday. */
export const DAY = 24

/** First h (fractional, ≤ maxH) where project(h) reaches 1.0, or null. project(0) is "now". */
function firstCrossing(project: (h: number) => number, maxH: number): number | null {
  let prev = project(0)
  for (let h = 1; h <= maxH; h++) {
    const cur = project(h)
    if (cur >= 1) return h - 1 + (cur > prev ? (1 - prev) / (cur - prev) : 1)
    prev = cur
  }
  return null
}

export function predictBlackout(
  loadHistory: number[],
  opts: { temperature?: number; blackout?: boolean } = {},
): BlackoutPrediction {
  if (opts.blackout) {
    return { riskPct: 100, hoursToFailure: 0, trendPerHour: 0, utilisation: 0, hoursRange: [0, 0], confidence: 'high', reason: 'Blackout in progress.' }
  }
  const n = loadHistory.length
  const recent = loadHistory.slice(-TREND_WINDOW).filter((v) => v > 0)
  const utilisation = recent.length ? recent[recent.length - 1] : 0
  if (utilisation >= 1) {
    return { riskPct: 100, hoursToFailure: 0, trendPerHour: 0, utilisation, hoursRange: [0, 0], confidence: 'high', reason: 'Feeder at capacity.' }
  }

  // Seasonal mode (preferred): with a day of clean history, measure the trend in the difference
  // from the same hour yesterday — this cancels the normal daily demand cycle — and project
  // forward along yesterday's shape plus that excess trend.
  const yesterday = loadHistory.slice(n - DAY - TREND_WINDOW, n)
  const seasonal = n >= DAY + TREND_WINDOW && yesterday.every((v) => v > 0)

  let trend: number
  let se: number
  let recentSlope: number
  let current: number
  let project: (h: number, s: number) => number
  if (seasonal) {
    const diffs = loadHistory.slice(n - TREND_WINDOW).map((v, i) => v - loadHistory[n - TREND_WINDOW + i - DAY])
    trend = slope(diffs)
    se = slopeStdErr(diffs)
    recentSlope = slope(diffs.slice(-3))
    current = loadHistory[n - 1]
    const ref = loadHistory[n - 1 - DAY]
    // Yesterday's change from this hour to h hours later (beyond a day, assume no daily change).
    const daily = (h: number) => (h < DAY ? loadHistory[n - 1 - DAY + h] - ref : 0)
    project = (h, s) => current + s * h + daily(h)
  } else {
    // Fallback (not enough clean history, e.g. just after a blackout): straight-line trend.
    current = recent.length >= 2 ? (recent[recent.length - 1] + recent[recent.length - 2]) / 2 : utilisation
    trend = recent.length >= 3 ? slope(recent) : 0
    se = slopeStdErr(recent)
    recentSlope = recent.length >= 3 ? slope(recent.slice(-3)) : trend
    project = (h, s) => current + s * h
  }

  // Only count a trend that is meaningfully upward (> 1% of capacity per hour).
  const upward = trend > 0.01
  const central = upward ? trend : 0
  const hoursToFailure = firstCrossing((h) => project(h, central), HORIZON_HOURS * 2)

  // Range: soonest uses the steepest credible slope (fit + 1.5 s.e., or the last 3 hours if
  // accelerating); latest uses the shallowest credible slope.
  let hoursRange: BlackoutPrediction['hoursRange'] = null
  let confidence: Confidence = 'low'
  if (hoursToFailure !== null) {
    const fast = Math.max(central + 1.5 * se, central * 1.25, upward ? recentSlope : 0)
    const slow = Math.max(0, Math.min(central - 1.5 * se, central * 0.8))
    const soonest = firstCrossing((h) => project(h, fast), HORIZON_HOURS * 2) ?? hoursToFailure
    const latest = firstCrossing((h) => project(h, slow), HORIZON_HOURS * 2)
    hoursRange = [Math.min(soonest, hoursToFailure), latest === null ? null : Math.max(latest, hoursToFailure)]
    const rel = se / Math.max(central, 0.005)
    // Far-off projections are less certain however clean the fit: demand rarely stays on trend.
    if (recent.length < 4) confidence = 'low'
    else if (rel < 0.25 && hoursRange[0] <= 8 && latest !== null && latest - hoursRange[0] <= Math.max(3, hoursRange[0] * 0.6))
      confidence = 'high'
    else if (rel < 0.5 && hoursRange[0] <= 16) confidence = 'medium'
    else confidence = 'low'
  }

  const fromUtil = logistic((current - 0.93) / 0.025)
  const fromTrend = hoursToFailure === null ? 0 : Math.max(0, 1 - hoursToFailure / HORIZON_HOURS)
  const heat = opts.temperature !== undefined && opts.temperature > 44 ? Math.min(0.15, (opts.temperature - 44) * 0.03) : 0

  const risk = Math.min(1, Math.max(fromUtil, fromTrend) + heat)
  const riskPct = Math.round(risk * 100)

  const pct = Math.round(current * 100)
  let reason: string
  if (hoursToFailure !== null && hoursToFailure <= HORIZON_HOURS) {
    reason = upward
      ? `Feeder at ${pct}% and climbing ~${(trend * 100).toFixed(1)}%/h ${seasonal ? 'faster than this time yesterday' : ''} — failure likely in ${formatHoursRange(hoursRange)}.`
      : `Feeder at ${pct}%; today's peak would push it past capacity in ${formatHoursRange(hoursRange)}.`
  } else if (current > 0.9) {
    reason = `Feeder running hot at ${pct}% of capacity.`
  } else {
    reason = `Feeder at ${pct}% of capacity, stable.`
  }
  reason = reason.replace('  ', ' ')
  if (heat > 0) reason += ' High heat adds cooling demand.'

  return { riskPct, hoursToFailure, trendPerHour: trend, utilisation: current, hoursRange, confidence, reason }
}

/** "6–12 hours", "under 1 hour", "8+ hours". */
export function formatHoursRange(r: BlackoutPrediction['hoursRange']): string {
  if (!r) return 'no failure projected'
  const lo = Math.max(1, Math.floor(r[0]))
  if (r[1] === null) return `${lo}+ hours`
  const hi = Math.max(lo, Math.ceil(r[1]))
  if (hi <= 1) return 'under 1 hour'
  return lo === hi ? `~${lo} hours` : `${lo}–${hi} hours`
}

export type RiskBand = 'low' | 'watch' | 'warning' | 'critical'

export function riskBand(riskPct: number): RiskBand {
  if (riskPct >= 85) return 'critical'
  if (riskPct >= 50) return 'warning'
  if (riskPct >= 25) return 'watch'
  return 'low'
}
