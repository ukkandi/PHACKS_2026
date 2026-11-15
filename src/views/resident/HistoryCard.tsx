import { Card } from '../../components/ui'
import { useResident } from '../../stores/residentStore'
import { tickLabel } from '../../sim/world'

/** Personal history. Stays on this device. (Fuller sleep/mood trends: phase 4.) */
export function HistoryCard() {
  const checkins = useResident((s) => s.checkins)
  if (!checkins.length) return null
  const recent = checkins.slice(0, 7)
  const avgMood = recent.reduce((a, c) => a + c.mood, 0) / recent.length
  const avgSleep = recent.reduce((a, c) => a + c.sleepHours, 0) / recent.length
  return (
    <Card title="Your last check-ins" right={<span className="text-xs text-hollow-500">only on this device</span>}>
      <p className="mb-3 text-sm text-hollow-300">
        Avg mood <strong className="text-white">{avgMood.toFixed(1)}/5</strong> · avg sleep{' '}
        <strong className="text-white">{avgSleep.toFixed(1)}h</strong> over {recent.length} check-in
        {recent.length > 1 ? 's' : ''}
      </p>
      <ul className="space-y-1 font-mono text-xs">
        {recent.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            <span className="w-28 text-hollow-500">{tickLabel(c.tick)}</span>
            <span className={c.okay ? 'text-ok' : 'text-danger'}>{c.okay ? 'okay' : 'help'}</span>
            <span aria-label={`mood ${c.mood}`} className="text-lamp">
              {'■'.repeat(c.mood)}
              <span className="text-hollow-700">{'■'.repeat(5 - c.mood)}</span>
            </span>
            <span className="text-hollow-300">{c.sleepHours}h</span>
            <span className="truncate text-hollow-500">{c.symptoms.join(', ')}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
