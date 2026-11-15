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
  /** Plain-language explanation for residents. */
  reason: string
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

export function predictBlackout(
  loadHistory: number[],
  opts: { temperature?: number; blackout?: boolean } = {},
): BlackoutPrediction {
  if (opts.blackout) {
    return { riskPct: 100, hoursToFailure: 0, trendPerHour: 0, utilisation: 0, reason: 'Blackout in progress.' }
  }
  const recent = loadHistory.slice(-TREND_WINDOW).filter((v) => v > 0)
  const utilisation = recent.length ? recent[recent.length - 1] : 0
  if (utilisation >= 1) {
    return { riskPct: 100, hoursToFailure: 0, trendPerHour: 0, utilisation, reason: 'Feeder at capacity.' }
  }
  // Use a smoothed "current" value so one noisy hour doesn't dominate.
  const smoothCurrent = recent.length >= 2 ? (recent[recent.length - 1] + recent[recent.length - 2]) / 2 : utilisation
  const trend = recent.length >= 3 ? slope(recent) : 0
  const headroom = 1 - smoothCurrent

  // Only call it a trend if it's meaningfully upward (> 1% of capacity per hour; the daily demand cycle stays below that).
  const hoursToFailure = trend > 0.01 ? Math.max(0, headroom / trend) : null

  const fromUtil = logistic((smoothCurrent - 0.93) / 0.025)
  const fromTrend = hoursToFailure === null ? 0 : Math.max(0, 1 - hoursToFailure / HORIZON_HOURS)
  const heat = opts.temperature !== undefined && opts.temperature > 44 ? Math.min(0.15, (opts.temperature - 44) * 0.03) : 0

  const risk = Math.min(1, Math.max(fromUtil, fromTrend) + heat)
  const riskPct = Math.round(risk * 100)

  const pct = Math.round(smoothCurrent * 100)
  let reason: string
  if (hoursToFailure !== null && hoursToFailure <= HORIZON_HOURS) {
    reason = `Feeder at ${pct}% and rising ~${(trend * 100).toFixed(1)}%/h — failure likely in ~${Math.round(hoursToFailure)}h.`
  } else if (smoothCurrent > 0.9) {
    reason = `Feeder running hot at ${pct}% of capacity.`
  } else {
    reason = `Feeder at ${pct}% of capacity, stable.`
  }
  if (heat > 0) reason += ' High heat adds cooling demand.'

  return { riskPct, hoursToFailure, trendPerHour: trend, utilisation: smoothCurrent, reason }
}

export type RiskBand = 'low' | 'watch' | 'warning' | 'critical'

export function riskBand(riskPct: number): RiskBand {
  if (riskPct >= 85) return 'critical'
  if (riskPct >= 50) return 'warning'
  if (riskPct >= 25) return 'watch'
  return 'low'
}
