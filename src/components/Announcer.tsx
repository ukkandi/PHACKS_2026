// Screen-reader live regions + the visual pulse (vibration fallback) + a visible caption.
import { useAlertFeed } from '../stores/alertFeed'
import type { AlertKind } from '../lib/spokenPhrases'

export const KIND_MARK: Record<AlertKind, { glyph: string; word: string; color: string; border: string }> = {
  ok: { glyph: '●', word: 'OK', color: 'text-ok', border: 'border-ok' },
  message: { glyph: '◆', word: 'MESSAGE', color: 'text-data', border: 'border-data' },
  warning: { glyph: '■', word: 'WARNING', color: 'text-warn', border: 'border-warn' },
  danger: { glyph: '▲', word: 'DANGER', color: 'text-danger', border: 'border-danger' },
}

/** Live regions: urgent alerts interrupt, everything else waits its turn. */
export function LiveRegions() {
  const latest = useAlertFeed((s) => s.latest)
  const urgent = latest && (latest.kind === 'danger' || latest.kind === 'warning')
  return (
    <>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {urgent ? <span key={latest.id}>{latest.text}</span> : null}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {latest && !urgent ? <span key={latest.id}>{latest.text}</span> : null}
      </div>
    </>
  )
}

/** Where the phone can't vibrate: a short, unmistakable visual pulse at the top of the screen. */
export function VisualPulse() {
  const pulse = useAlertFeed((s) => s.pulse)
  if (!pulse) return null
  const m = KIND_MARK[pulse.kind]
  return (
    <div
      aria-hidden
      data-testid="visual-pulse"
      className={`lantern-pulse fixed inset-x-0 top-0 z-50 border-b-4 bg-hollow-950 px-4 py-3 ${m.border}`}
    >
      {pulse.kind === 'danger' && <div className="hazard -mx-4 -mt-3 mb-2 h-2" />}
      <div className={`font-mono text-lg font-bold tracking-wider uppercase ${m.color}`}>
        {m.glyph} {m.word}
      </div>
      <div className="font-mono text-sm text-cream">{pulse.text}</div>
    </div>
  )
}

/** Visible caption of the last alert (what was — or would have been — said aloud). */
export function AlertCaption() {
  const latest = useAlertFeed((s) => s.latest)
  if (!latest) return null
  const m = KIND_MARK[latest.kind]
  return (
    <div aria-hidden className={`border-l-4 bg-hollow-900 px-3 py-1.5 ${m.border}`} data-testid="alert-caption">
      <span className={`font-mono text-sm font-bold tracking-wider uppercase ${m.color}`}>
        {m.glyph} {m.word}
      </span>{' '}
      <span className="text-sm">{latest.text}</span>
    </div>
  )
}
