import { Explain, StateTag } from '../../components/ui'
import { ADVICE, alertBand } from '../../lib/alerts'
import { formatHoursRange, predictBlackout } from '../../sim/predict'
import type { World } from '../../sim/types'

/**
 * Blackout warning for this level, computed ON THIS DEVICE from the level's power-meter history.
 * Status first; the reasoning and advice sit behind "?".
 */
export function WarningBanner({ world, level }: { world: World | null; level: number }) {
  if (!world) return null
  const l = world.levels[level - 1]
  const p = predictBlackout(l.loadHistory, { temperature: l.temperature, blackout: l.blackout })
  const band = alertBand(p, l.blackout)

  if (band === 'clear') {
    return p.riskPct >= 25 ? (
      <div className="flex items-center justify-between border-2 border-warn px-3 py-1.5">
        <StateTag state="watch">Power watch · risk {p.riskPct}%</StateTag>
        <Explain label="Why power watch">{p.reason}</Explain>
      </div>
    ) : null
  }

  const danger = band === 'blackout' || band === 'critical'
  return (
    <section role="alert" className={`border-2 ${danger ? 'border-danger' : 'border-warn'}`}>
      {danger && <div className="hazard h-3" aria-hidden />}
      <div className="flex items-start justify-between gap-3 px-3 py-2">
        <div>
          <h2 className={`font-mono text-xl font-bold tracking-wide uppercase sm:text-2xl ${danger ? 'text-danger' : 'text-warn'}`}>
            {band === 'blackout' ? `Blackout · Level ${level}` : `Blackout risk · ${formatHoursRange(p.hoursRange)}`}
          </h2>
          <div className="mt-0.5 flex flex-wrap gap-x-4 font-mono text-xs tracking-wider text-hollow-300 uppercase">
            {band === 'blackout' ? (
              <span>Power + net down</span>
            ) : (
              <>
                <span>{p.confidence} confidence</span>
                <span>Risk {p.riskPct}%</span>
              </>
            )}
            <span>From level meter</span>
          </div>
        </div>
        <Explain label="What to do">
          <p className="mb-2">{band === 'blackout' ? 'Power and the Directorate network are down on your level.' : p.reason}</p>
          <ul className="mb-2 list-disc space-y-1 pl-5">
            {ADVICE[band].map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="text-hollow-300">
            {band === 'blackout' ? 'Detected' : 'Predicted'} on this device from Level {level}'s power meter. The Directorate
            has not announced anything.
          </p>
        </Explain>
      </div>
    </section>
  )
}
