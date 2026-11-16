import { StatusTile } from '../../components/ui'
import { airState, heatState, powerState, waterState, type State } from '../../lib/status'
import { predictBlackout, riskBand } from '../../sim/predict'
import type { World } from '../../sim/types'

const POWER_WORD = { low: 'ON', watch: 'WATCH', warning: 'AT RISK', critical: 'FAILING' } as const
const AIR_WORD: Record<State, string> = { normal: 'GOOD', watch: 'POOR', danger: 'BAD', nodata: 'NO DATA' }
const WATER_WORD: Record<State, string> = { normal: 'SAFE', watch: 'CHECK', danger: 'UNSAFE', nodata: 'NO DATA' }
const HEAT_WORD: Record<State, string> = { normal: 'OK', watch: 'HOT', danger: 'DANGER', nodata: 'NO DATA' }

/**
 * The level at a glance, from its public meters.
 * SIMULATED: readings come from the World Simulator feed. A device only reads its OWN level.
 * With no feed the tiles stay, marked NO DATA — never a guess.
 */
export function LevelStatus({ world, level, compact = false }: { world: World | null; level: number; compact?: boolean }) {
  const grid = `grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`
  const l = world?.levels[level - 1]
  if (!l) {
    const labels = compact ? ['Power', 'Air', 'Heat'] : ['Power', 'Air', 'Water', 'Heat']
    return (
      <div className={grid}>
        {labels.map((label) => (
          <StatusTile key={label} label={label} state="nodata" word="NO DATA" value="no reading yet" />
        ))}
      </div>
    )
  }
  const band = riskBand(predictBlackout(l.loadHistory, { temperature: l.temperature, blackout: l.blackout }).riskPct)
  const power = l.blackout ? 'danger' : band === 'watch' ? 'watch' : powerState(false, band)
  const air = airState(l.airQuality)
  const water = waterState(l.waterQuality)
  const heat = heatState(l.temperature)
  return (
    <div className={grid}>
      <StatusTile
        label="Power"
        state={power}
        word={l.blackout ? 'OUT' : POWER_WORD[band]}
        value={l.blackout ? 'tripped' : `${Math.round((l.powerLoad / l.powerCapacity) * 100)}% load`}
      />
      <StatusTile label="Air" state={air} word={AIR_WORD[air]} value={`${Math.round(l.airQuality)}/100`} />
      {!compact && <StatusTile label="Water" state={water} word={WATER_WORD[water]} value={`${Math.round(l.waterQuality)}/100`} />}
      <StatusTile label="Heat" state={heat} word={HEAT_WORD[heat]} value={`${l.temperature.toFixed(1)} °C`} />
    </div>
  )
}
