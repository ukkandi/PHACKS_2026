// Display mapping for the notice board: each cell becomes a short word + NORMAL/WATCH/DANGER,
// or NO DATA (grey) when there are no readings or too few reports to say anything.
import type { LevelView } from '../../lib/ledger'
import { MIN_REPORTS } from '../../lib/outbreak'
import { airState, worst, type State } from '../../lib/status'
import type { OfficialLevel } from '../../sim/directorate'
import { formatHoursRange } from '../../sim/predict'

export interface Cell {
  state: State
  word: string
}

const NO_DATA: Cell = { state: 'nodata', word: 'NO DATA' }
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`

export function powerCell(l: LevelView): Cell {
  const a = l.alert
  if (l.conditions?.powerOut || a?.band === 'blackout') return { state: 'danger', word: 'OUT' }
  if (a?.band === 'critical') return { state: 'danger', word: `FAIL ${formatHoursRange(a.hoursRange).replace(' hours', 'H')}` }
  if (a?.band === 'warning') return { state: 'watch', word: `RISK ${formatHoursRange(a.hoursRange).replace(' hours', 'H')}` }
  // No meter reading and no alert heard: we don't know.
  if (!l.conditions && !a) return NO_DATA
  return { state: 'normal', word: 'OK' }
}

export function illnessCell(l: LevelView): Cell {
  const o = l.outbreak
  if (o.status === 'insufficient') return NO_DATA
  if (o.status === 'outbreak') return { state: 'danger', word: `${pct1(o.rate)} ▲` }
  if (o.status === 'watch') return { state: 'watch', word: pct1(o.rate) }
  return { state: 'normal', word: pct1(o.rate) }
}

export function waterCell(l: LevelView, official?: OfficialLevel): Cell {
  if (l.reports < MIN_REPORTS) return NO_DATA
  const p = Math.round(l.waterBadShare * 100)
  if (l.waterBadShare >= 0.2) return { state: 'danger', word: `BAD ${p}%${official?.water === 'safe' ? ' *' : ''}` }
  if (l.waterBadShare >= 0.1) return { state: 'watch', word: `CHECK ${p}%` }
  return { state: 'normal', word: `OK ${p}%` }
}

export function airCell(l: LevelView): Cell {
  if (!l.conditions) return NO_DATA
  const s = airState(l.conditions.air)
  return { state: s, word: `${{ normal: 'GOOD', watch: 'POOR', danger: 'BAD', nodata: 'NO DATA' }[s]} ${Math.round(l.conditions.air)}` }
}

/** A level with no reports is NO DATA, never NORMAL; otherwise the worst state we actually know. */
export function rowState(l: LevelView, official?: OfficialLevel): State {
  if (l.reports === 0) return 'nodata'
  return worst(powerCell(l).state, illnessCell(l).state, waterCell(l, official).state, airCell(l).state)
}
