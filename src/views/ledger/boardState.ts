// Display mapping for the notice board: each cell becomes a short word + NORMAL/WATCH/DANGER.
import type { LevelView } from '../../lib/ledger'
import { airState, worst, type State } from '../../lib/status'
import type { OfficialLevel } from '../../sim/directorate'
import { formatHoursRange } from '../../sim/predict'

export interface Cell {
  state: State
  word: string
}

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`

export function powerCell(l: LevelView): Cell {
  const a = l.alert
  if (l.conditions?.powerOut || a?.band === 'blackout') return { state: 'danger', word: 'OUT' }
  if (a?.band === 'critical') return { state: 'danger', word: `FAIL ${formatHoursRange(a.hoursRange).replace(' hours', 'H')}` }
  if (a?.band === 'warning') return { state: 'watch', word: `RISK ${formatHoursRange(a.hoursRange).replace(' hours', 'H')}` }
  return { state: 'normal', word: 'OK' }
}

export function illnessCell(l: LevelView): Cell {
  const o = l.outbreak
  if (o.status === 'insufficient') return { state: 'normal', word: '—' }
  if (o.status === 'outbreak') return { state: 'danger', word: `${pct1(o.rate)} ▲` }
  if (o.status === 'watch') return { state: 'watch', word: pct1(o.rate) }
  return { state: 'normal', word: pct1(o.rate) }
}

export function waterCell(l: LevelView, official?: OfficialLevel): Cell {
  if (!l.reports) return { state: 'normal', word: '—' }
  const p = Math.round(l.waterBadShare * 100)
  if (l.waterBadShare >= 0.2) return { state: 'danger', word: `BAD ${p}%${official?.water === 'safe' ? ' *' : ''}` }
  if (l.waterBadShare >= 0.1) return { state: 'watch', word: `CHECK ${p}%` }
  return { state: 'normal', word: `OK ${p}%` }
}

export function airCell(l: LevelView): Cell {
  if (!l.conditions) return { state: 'normal', word: '—' }
  const s = airState(l.conditions.air)
  return { state: s, word: `${{ normal: 'GOOD', watch: 'POOR', danger: 'BAD' }[s]} ${Math.round(l.conditions.air)}` }
}

export function rowState(l: LevelView, official?: OfficialLevel): State {
  return worst(powerCell(l).state, illnessCell(l).state, waterCell(l, official).state, airCell(l).state)
}
