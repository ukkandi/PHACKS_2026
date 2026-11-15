// SIMULATED: the Directorate's official public bulletin. Deliberately not the truth — it
// under-reports illness, calls water safe, acknowledges blackouts late, and sends reserve power
// to the administrative levels first. Lantern's ledger shows it side by side with community data.
import type { World } from './types'

export interface OfficialLevel {
  level: number
  /** Official share of residents with symptoms. */
  symptomRate: number
  water: 'safe' | 'advisory'
  power: 'normal' | 'planned maintenance'
}

export interface OfficialAllocation {
  levels: number[]
  mw: number
  purpose: 'air' | 'water' | 'cooling' | 'light' | 'administration'
  label: string
}

export interface DirectorateBulletin {
  tick: number
  reserveMW: number
  levels: OfficialLevel[]
  allocations: OfficialAllocation[]
  statement: string
}

/** Hours before the Directorate admits a blackout (and sends anything). */
export const ACK_DELAY = 4

export function directorateBulletin(world: World): DirectorateBulletin {
  const levels: OfficialLevel[] = world.levels.map((l) => ({
    level: l.level,
    // Report the normal baseline faithfully, but only ~15% of anything above it.
    symptomRate: Math.min(l.symptomRate, l.symptomBaseline) * 0.95 + Math.max(0, l.symptomRate - l.symptomBaseline) * 0.15,
    water: l.waterQuality < 25 ? 'advisory' : 'safe',
    power: l.blackout && l.blackoutSince !== null && world.tick - l.blackoutSince >= ACK_DELAY ? 'planned maintenance' : 'normal',
  }))

  let reserve = world.reserveMW
  const allocations: OfficialAllocation[] = []
  for (const l of world.levels) {
    if (l.airBackup && reserve >= 4) {
      allocations.push({ levels: [l.level], mw: 4, purpose: 'air', label: `Level ${l.level} air pumps (emergency line)` })
      reserve -= 4
    }
  }
  const acknowledged = levels.filter((o) => o.power === 'planned maintenance').map((o) => o.level)
  for (const level of acknowledged) {
    if (reserve < 2) break
    allocations.push({ levels: [level], mw: 2, purpose: 'light', label: `Level ${level} corridor lighting` })
    reserve -= 2
  }
  if (reserve > 0) {
    allocations.push({
      levels: [1, 2, 3],
      mw: reserve,
      purpose: 'administration',
      label: 'Levels 1–3 administrative districts (lighting & climate)',
    })
  }

  const statement =
    acknowledged.length > 0
      ? `Planned maintenance on Level${acknowledged.length > 1 ? 's' : ''} ${acknowledged.join(', ')}. Air and water across the Hollow remain within safe limits.`
      : 'All levels operating normally. Air and water within safe limits.'

  return { tick: world.tick, reserveMW: world.reserveMW, levels, allocations, statement }
}
