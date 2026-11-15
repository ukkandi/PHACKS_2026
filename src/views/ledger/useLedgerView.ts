import { useMemo } from 'react'
import { recommendAllocation, type LevelNeedInput } from '../../lib/allocation'
import { tallyVotes } from '../../lib/votes'
import { buildLedger, UNSIGNED_REASON, type WardenCheck } from '../../lib/ledger'
import { shortFp } from '../../lib/wardenCrypto'
import { isActiveWarden, useWardenRegistry, VOUCHES_REQUIRED, wardenStatuses } from '../../lib/wardenRegistry'
import { useWorld } from '../../lib/worldFeed'
import { directorateBulletin } from '../../sim/directorate'
import { useLedger } from '../../stores/ledgerStore'

export function useLedgerView() {
  const world = useWorld()
  const { summaries, alerts, verifies, votes } = useLedger()
  // Community-set priorities: Borda count of every level's latest ballot.
  const tally = useMemo(() => tallyVotes(Object.values(votes)), [votes])
  const priorities = tally.order
  const tick = world?.tick ?? summaries.reduce((m, s) => Math.max(m, s.tick), 0)

  // Warden items count only if signed by a key this device has seen vouched by 3 residents of that level.
  const wardens = useWardenRegistry((s) => s.wardens)
  const vouches = useWardenRegistry((s) => s.vouches)
  const wardenCheck = useMemo<WardenCheck>(() => {
    const statuses = wardenStatuses(Object.values(wardens), Object.values(vouches))
    return (fp, ok, level) =>
      !fp || !ok
        ? UNSIGNED_REASON
        : isActiveWarden(statuses, fp, level)
          ? null
          : `Unverified warden: key ${shortFp(fp)} is not vouched by ${VOUCHES_REQUIRED} residents of L${level}. Rejected.`
  }, [wardens, vouches])

  const view = useMemo(
    () => buildLedger(summaries, alerts, verifies, tick, wardenCheck),
    [summaries, alerts, verifies, tick, wardenCheck],
  )
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

  return { world, view, bulletin, plan, tick, tally }
}
