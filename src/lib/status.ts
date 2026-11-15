// Status vocabulary for every screen: three states, readable in two seconds.
// Pure display mapping of numbers the app already computes — no new logic.
import type { RiskBand } from '../sim/predict'

export type State = 'normal' | 'watch' | 'danger'

export const STATE_WORD: Record<State, string> = { normal: 'NORMAL', watch: 'WATCH', danger: 'DANGER' }

export function worst(...states: State[]): State {
  return states.includes('danger') ? 'danger' : states.includes('watch') ? 'watch' : 'normal'
}

export function powerState(blackout: boolean, band: RiskBand): State {
  if (blackout || band === 'critical') return 'danger'
  return band === 'warning' ? 'watch' : 'normal'
}

/** Same thresholds the app already used: air < 65 is bad. */
export function airState(air: number): State {
  return air < 65 ? 'danger' : air < 75 ? 'watch' : 'normal'
}

export function waterState(quality: number): State {
  return quality < 50 ? 'danger' : quality < 70 ? 'watch' : 'normal'
}

/** > 44 °C danger, > 38 °C watch (as before). */
export function heatState(temp: number): State {
  return temp > 44 ? 'danger' : temp > 38 ? 'watch' : 'normal'
}

/** Display-only: sector = block of 100 units, 1-based ("38-114" → sector 2). */
export function sectorOf(unit: string): number {
  const n = Number(unit.split('-')[1])
  return Number.isFinite(n) ? Math.floor(n / 100) + 1 : 1
}

/** "just now", "40 s ago", "3 min ago", "2 h ago" — for trust lines. */
export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  return `${Math.round(m / 60)} h ago`
}
