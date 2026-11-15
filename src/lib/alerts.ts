import type { AlertBody } from './mesh'
import { predictBlackout, riskBand, type BlackoutPrediction } from '../sim/predict'
import type { LevelState } from '../sim/types'

export type AlertBand = AlertBody['band']

export function alertBand(p: BlackoutPrediction, blackout: boolean): AlertBand {
  if (blackout) return 'blackout'
  const b = riskBand(p.riskPct)
  return b === 'critical' ? 'critical' : b === 'warning' ? 'warning' : 'clear'
}

/** Build the alert a device on this level would broadcast from its local meter reading. */
export function alertForLevel(l: LevelState, tick: number): AlertBody {
  const p = predictBlackout(l.loadHistory, { temperature: l.temperature, blackout: l.blackout })
  return {
    kind: 'alert',
    level: l.level,
    band: alertBand(p, l.blackout),
    riskPct: p.riskPct,
    hoursToFailure: p.hoursToFailure,
    reason: p.reason,
    tick,
  }
}

/**
 * Decides when to broadcast: only when a level's band changes (so the mesh isn't flooded every
 * hour), and an all-clear only after a real alert. Pure state machine, one per device.
 */
export class AlertEmitter {
  private last = new Map<number, AlertBand>()
  shouldSend(level: number, band: AlertBand): boolean {
    const prev = this.last.get(level) ?? 'clear'
    this.last.set(level, band)
    return band !== prev
  }
}

export const ADVICE: Record<Exclude<AlertBand, 'clear'>, string[]> = {
  warning: ['Charge phones and lamps now.', 'Fill water containers.', 'Check who on your block has no device.'],
  critical: [
    'Charge everything now — failure expected within hours.',
    'Know your nearest air station and the stairwell route up.',
    'Check in on elderly neighbours and anyone on oxygen.',
  ],
  blackout: [
    'Stay low and still: it gets hot fast without cooling.',
    'Lantern keeps working: messages hop through nearby devices.',
    'Ration lamp battery. Head to the air station if breathing gets hard.',
  ],
}
