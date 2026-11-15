// Allocation engine: share a limited power reserve by the community's published priorities,
// weighted by need and by how many people are affected. Pure, deterministic, explainable.

export type Purpose = 'air' | 'water' | 'cooling' | 'light'

export const DEFAULT_PRIORITIES: Purpose[] = ['air', 'water', 'cooling', 'light']

export const PURPOSE_LABEL: Record<Purpose, string> = {
  air: 'air pumps',
  water: 'water recycler flush',
  cooling: 'emergency cooling',
  light: 'corridor lighting',
}

export interface LevelNeedInput {
  level: number
  population: number
  powerOut: boolean
  /** 0–100 */
  air: number
  temperature: number
  /** Share of recent reports saying the water is bad. */
  waterBadShare: number
  outbreak: boolean
}

export interface Allocation {
  level: number
  purpose: Purpose
  mw: number
  /** Full need for this item (mw may be less if the reserve ran out). */
  needMW: number
  score: number
  reason: string
}

export interface AllocationPlan {
  reserveMW: number
  allocations: Allocation[]
  unmet: Allocation[]
}

interface Need {
  level: number
  purpose: Purpose
  needMW: number
  severity: number
  why: string
}

const POP_REF = 50_000_000

function needsFor(l: LevelNeedInput): Need[] {
  const out: Need[] = []
  const scale = Math.max(0.6, l.population / POP_REF)
  const sick = l.outbreak ? ' Outbreak on level: sick residents are more vulnerable.' : ''
  if (l.powerOut || l.air < 65) {
    out.push({
      level: l.level,
      purpose: 'air',
      needMW: +(4 * scale).toFixed(1),
      severity: (l.powerOut ? 1.5 : 1) + Math.max(0, 75 - l.air) / 20 + (l.outbreak ? 0.5 : 0),
      why: `${l.powerOut ? 'Power out, air pumps stopped. ' : ''}Air quality ${Math.round(l.air)}/100.${sick}`,
    })
  }
  if (l.waterBadShare >= 0.2) {
    out.push({
      level: l.level,
      purpose: 'water',
      needMW: +(2 * scale).toFixed(1),
      severity: l.waterBadShare * 4,
      why: `${Math.round(l.waterBadShare * 100)}% of recent check-ins report bad water.`,
    })
  }
  // Deep levels normally run ~44 °C on working cooling; only flag real excursions.
  if (l.temperature >= 46.5 || (l.powerOut && l.temperature >= 40)) {
    out.push({
      level: l.level,
      purpose: 'cooling',
      needMW: +(3 * scale).toFixed(1),
      severity: (l.temperature - 38) / 4 + (l.outbreak ? 0.5 : 0),
      why: `${l.temperature.toFixed(1)} °C${l.powerOut ? ' with cooling offline' : ''}.${sick}`,
    })
  }
  if (l.powerOut) {
    out.push({ level: l.level, purpose: 'light', needMW: +(1.5 * scale).toFixed(1), severity: 1, why: 'Corridors dark.' })
  }
  return out
}

export function recommendAllocation(
  levels: LevelNeedInput[],
  reserveMW: number,
  priorities: Purpose[] = DEFAULT_PRIORITIES,
): AllocationPlan {
  const weight = (p: Purpose) => 2 ** (priorities.length - 1 - priorities.indexOf(p))
  const pop = new Map(levels.map((l) => [l.level, l.population]))
  const scored = levels
    .flatMap(needsFor)
    .map((n) => ({ ...n, score: weight(n.purpose) * n.severity * Math.max(0.6, (pop.get(n.level) ?? POP_REF) / POP_REF) }))
    .sort((a, b) => b.score - a.score || a.level - b.level)

  let remaining = reserveMW
  const allocations: Allocation[] = []
  const unmet: Allocation[] = []
  for (const n of scored) {
    const rank = priorities.indexOf(n.purpose) + 1
    const reason = `Level ${n.level} ${PURPOSE_LABEL[n.purpose]}: ${n.why} Priority #${rank} (${n.purpose}).`
    const mw = Math.min(n.needMW, +remaining.toFixed(1))
    if (mw >= 0.5) {
      allocations.push({ level: n.level, purpose: n.purpose, mw, needMW: n.needMW, score: n.score, reason })
      remaining -= mw
    }
    if (mw < n.needMW) unmet.push({ level: n.level, purpose: n.purpose, mw: 0, needMW: +(n.needMW - Math.max(0, mw >= 0.5 ? mw : 0)).toFixed(1), score: n.score, reason })
  }
  return { reserveMW, allocations, unmet }
}
