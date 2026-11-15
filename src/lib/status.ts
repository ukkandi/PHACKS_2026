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
