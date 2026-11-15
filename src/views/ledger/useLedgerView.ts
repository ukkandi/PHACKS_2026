import { useMemo } from 'react'
import { recommendAllocation, type LevelNeedInput, type Purpose } from '../../lib/allocation'
import { buildLedger } from '../../lib/ledger'
import { useWorld } from '../../lib/worldFeed'
import { directorateBulletin } from '../../sim/directorate'
import { useLedger } from '../../stores/ledgerStore'

export function useLedgerView(priorities: Purpose[]) {
  const world = useWorld()
  const { summaries, alerts, verifies } = useLedger()
  const tick = world?.tick ?? summaries.reduce((m, s) => Math.max(m, s.tick), 0)

  const view = useMemo(() => buildLedger(summaries, alerts, verifies, tick), [summaries, alerts, verifies, tick])
  // SIMULATED: the Directorate's public bulletin arrives with the world feed.
  const bulletin = useMemo(() => (world ? directorateBulletin(world) : null), [world])

  const plan = useMemo(() => {
    const inputs: LevelNeedInput[] = view.levels
      .filter((l) => l.conditions)
      .map((l) => ({
        level: l.level,
        population: l.conditions!.population,
        powerOut: l.conditions!.powerOut || l.alert?.band === 'blackout',
        air: l.conditions!.air,
        temperature: l.conditions!.temperature,
        waterBadShare: l.reports >= 10 ? l.waterBadShare : 0,
        outbreak: l.outbreak.status === 'outbreak',
      }))
    return recommendAllocation(inputs, bulletin?.reserveMW ?? 14, priorities)
  }, [view, bulletin, priorities])

  return { world, view, bulletin, plan, tick }
}
