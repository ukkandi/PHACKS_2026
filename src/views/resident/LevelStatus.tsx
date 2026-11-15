import { StatusTile } from '../../components/ui'
import { airState, heatState, powerState, waterState } from '../../lib/status'
import { predictBlackout, riskBand } from '../../sim/predict'
import type { World } from '../../sim/types'

const POWER_WORD = { low: 'ON', watch: 'WATCH', warning: 'AT RISK', critical: 'FAILING' } as const

/**
 * The level at a glance, from its public meters.
 * SIMULATED: readings come from the World Simulator feed. A device only reads its OWN level.
 */
export function LevelStatus({ world, level, compact = false }: { world: World | null; level: number; compact?: boolean }) {
  if (!world) return <p className="font-mono text-xs text-hollow-500 uppercase">No meter feed yet</p>
  const l = world.levels[level - 1]
  const band = riskBand(predictBlackout(l.loadHistory, { temperature: l.temperature, blackout: l.blackout }).riskPct)
  const power = l.blackout ? 'danger' : band === 'watch' ? 'watch' : powerState(false, band)
  const air = airState(l.airQuality)
  const water = waterState(l.waterQuality)
  const heat = heatState(l.temperature)
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
      <StatusTile
        label="Power"
        state={power}
        word={l.blackout ? 'OUT' : POWER_WORD[band]}
        value={l.blackout ? 'tripped' : `${Math.round((l.powerLoad / l.powerCapacity) * 100)}% load`}
      />
      <StatusTile label="Air" state={air} word={{ normal: 'GOOD', watch: 'POOR', danger: 'BAD' }[air]} value={`${Math.round(l.airQuality)}/100`} />
      {!compact && (
        <StatusTile label="Water" state={water} word={{ normal: 'SAFE', watch: 'CHECK', danger: 'UNSAFE' }[water]} value={`${Math.round(l.waterQuality)}/100`} />
      )}
      <StatusTile label="Heat" state={heat} word={{ normal: 'OK', watch: 'HOT', danger: 'DANGER' }[heat]} value={`${l.temperature.toFixed(1)} °C`} />
    </div>
  )
}
