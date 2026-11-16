import { Button, Trust } from '../../components/ui'
import { canVibrate, useAlertFeed } from '../../stores/alertFeed'

/** Spoken alerts toggle (default: on in blackout mode) and how this phone will signal alerts. */
export function AlertSettings() {
  const spokenPref = useAlertFeed((s) => s.spokenPref)
  const blackout = useAlertFeed((s) => s.blackout)
  const setSpoken = useAlertFeed((s) => s.setSpoken)
  const announce = useAlertFeed((s) => s.announce)
  const on = spokenPref ?? blackout
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        aria-pressed={on}
        className="min-h-11"
        tone={on ? 'primary' : 'default'}
        onClick={() => setSpoken(!on)}
      >
        {on ? '● Spoken alerts: on' : '○ Spoken alerts: off'}
      </Button>
      <Button tone="ghost" className="min-h-11" onClick={() => announce({ kind: 'ok', text: 'This is Lantern. Alerts will sound like this.' })}>
        Test alert
      </Button>
      <Trust tone="muted">{canVibrate() ? 'Vibration on' : 'No vibration here · screen flashes'}</Trust>
      {spokenPref === null && <Trust tone="muted">Speaks on its own in a blackout</Trust>}
    </div>
  )
}
