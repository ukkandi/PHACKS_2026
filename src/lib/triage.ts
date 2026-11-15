// Care triage for a warden's block: who should the warden visit first? Pure + explainable.
import type { CareEntry, RosterEntry } from './wardenDb'

export interface TriageRow {
  unit: string
  name: string
  score: number
  reasons: string[]
  last: CareEntry | null
  roster: RosterEntry | null
  status: 'needs-help' | 'unwell' | 'missing' | 'okay'
}

export function triage(roster: RosterEntry[], care: CareEntry[], tick: number): TriageRow[] {
  const latest = new Map<string, CareEntry>()
  for (const c of care) {
    const prev = latest.get(c.unit)
    if (!prev || c.tick >= prev.tick) latest.set(c.unit, c)
  }
  const units = new Set([...roster.map((r) => r.unit), ...latest.keys()])
  const rows: TriageRow[] = []
  for (const unit of units) {
    const r = roster.find((x) => x.unit === unit) ?? null
    const last = latest.get(unit) ?? null
    const reasons: string[] = []
    let score = 0
    const visitedSince = r?.visitedTick !== undefined && last !== null && r.visitedTick >= last.tick
    const fresh = last !== null && tick - last.tick < 24
    if (last && fresh && !last.okay && !visitedSince) {
      score += 100
      reasons.push('asked for help')
    }
    if (last && fresh) {
      if (last.symptoms.includes('breathing')) {
        score += 40
        reasons.push('breathing trouble')
      }
      if (last.symptoms.includes('fever')) {
        score += 20
        reasons.push('fever')
      }
      if (last.mood <= 1) {
        score += 10
        reasons.push('very low mood')
      }
    }
    if (!fresh && !(r?.visitedTick !== undefined && tick - r.visitedTick < 24)) {
      score += r?.vulnerable ? 35 : 10
      reasons.push(last ? `no check-in for ${tick - last.tick}h` : 'no check-in yet')
    }
    if (r?.vulnerable && score > 0) {
      score += 30
      reasons.push('vulnerable')
    }
    const status: TriageRow['status'] = reasons.includes('asked for help')
      ? 'needs-help'
      : reasons.some((x) => x === 'breathing trouble' || x === 'fever')
        ? 'unwell'
        : !fresh
          ? 'missing'
          : 'okay'
    rows.push({ unit, name: r?.name ?? last?.name ?? `Unit ${unit}`, score, reasons, last, roster: r, status })
  }
  return rows.sort((a, b) => b.score - a.score || a.unit.localeCompare(b.unit))
}
