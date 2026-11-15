import { ADVICE, alertBand } from '../../lib/alerts'
import { formatHoursRange, predictBlackout } from '../../sim/predict'
import type { World } from '../../sim/types'

const CONFIDENCE_NOTE = {
  high: 'Demand has climbed steadily; this window is reliable.',
  medium: 'The trend is clear but could speed up or slow down.',
  low: 'Early signal. Prepare anyway; the estimate will sharpen hourly.',
} as const

/**
 * Blackout warning for the resident's own level, computed ON THIS DEVICE from the level's
 * power-meter history (no server, no Directorate announcement needed).
 */
export function WarningBanner({ world, level }: { world: World | null; level: number }) {
  if (!world) return null
  const l = world.levels[level - 1]
  const p = predictBlackout(l.loadHistory, { temperature: l.temperature, blackout: l.blackout })
  const band = alertBand(p, l.blackout)

  if (band === 'clear') {
    return p.riskPct >= 25 ? (
      <p className="rounded-lg border border-hollow-700 bg-hollow-900 px-4 py-2 text-sm text-hollow-300">
        Power watch, Level {level}: blackout risk {p.riskPct}%. {p.reason}
      </p>
    ) : null
  }

  const blackout = band === 'blackout'
  const tone = blackout || band === 'critical' ? 'border-danger bg-danger/15' : 'border-warn bg-warn/10'

  return (
    <section role="alert" className={`rounded-xl border-2 p-4 ${tone}`}>
      <h2 className={`text-xl font-bold ${blackout || band === 'critical' ? 'text-danger' : 'text-warn'}`}>
        {blackout
          ? `Blackout on Level ${level}`
          : `Blackout likely on Level ${level}${p.hoursRange ? ` in ${formatHoursRange(p.hoursRange)}` : ''}`}
      </h2>
      <p className="mt-1 text-sm">
        {blackout ? 'Power and the Directorate network are down on your level.' : `Risk ${p.riskPct}%. ${p.reason}`}
      </p>
      {!blackout && p.hoursRange && (
        <p className="mt-1 text-sm">
          <span className="rounded border border-current px-1.5 py-0.5 text-xs font-semibold uppercase">
            {p.confidence} confidence
          </span>{' '}
          <span className="text-hollow-300">{CONFIDENCE_NOTE[p.confidence]}</span>
        </p>
      )}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {ADVICE[band].map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-hollow-300">
        {blackout ? 'Detected' : 'Predicted'} on this device from Level {level}'s power meter. The Directorate has not
        announced anything.
      </p>
    </section>
  )
}
