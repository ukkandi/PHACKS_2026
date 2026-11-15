import { Card } from '../../components/ui'
import type { CheckIn } from '../../lib/db'
import { useResident } from '../../stores/residentStore'
import { tickLabel } from '../../sim/world'

const W = 280
const H = 70

/** Tiny line chart; values are oldest → newest. */
function Spark({ values, max, color, label }: { values: number[]; max: number; color: string; label: string }) {
  if (values.length < 2) return null
  const x = (i: number) => (i / (values.length - 1)) * (W - 8) + 4
  const y = (v: number) => H - 6 - (v / max) * (H - 12)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label={label}>
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={color} />
      ))}
    </svg>
  )
}

/** Plain-language pattern from the person's own data — computed on device, never shared. */
export function sleepMoodInsight(cs: CheckIn[]): string | null {
  const short = cs.filter((c) => c.sleepHours < 6)
  const long = cs.filter((c) => c.sleepHours >= 6)
  if (short.length < 2 || long.length < 2) return null
  const avg = (xs: CheckIn[]) => xs.reduce((a, c) => a + c.mood, 0) / xs.length
  const a = avg(short)
  const b = avg(long)
  if (Math.abs(a - b) < 0.5) return `Your mood looks about the same whatever you sleep (${a.toFixed(1)} vs ${b.toFixed(1)}).`
  return `On days after under 6h of sleep your mood averages ${a.toFixed(1)}/5, vs ${b.toFixed(1)}/5 after more sleep.`
}

/** Personal trends. Stays on this device. */
export function HistoryCard() {
  const checkins = useResident((s) => s.checkins)
  if (!checkins.length) return null
  const recent = checkins.slice(0, 7)
  const series = checkins.slice(0, 14).reverse()
  const avgMood = recent.reduce((a, c) => a + c.mood, 0) / recent.length
  const avgSleep = recent.reduce((a, c) => a + c.sleepHours, 0) / recent.length
  const insight = sleepMoodInsight(checkins.slice(0, 30))
  return (
    <Card title="Your sleep & mood" right={<span className="text-xs text-hollow-500">only on this device</span>}>
      <p className="mb-2 text-sm text-hollow-300">
        Avg mood <strong className="text-cream">{avgMood.toFixed(1)}/5</strong> · avg sleep{' '}
        <strong className="text-cream">{avgSleep.toFixed(1)}h</strong> over {recent.length} check-in
        {recent.length > 1 ? 's' : ''}
      </p>
      {series.length >= 2 && (
        <div className="mb-2 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-lamp">Mood (1–5)</div>
            <Spark values={series.map((c) => c.mood)} max={5} color="#F2A33A" label={`Mood over your last ${series.length} check-ins`} />
          </div>
          <div>
            <div className="text-xs text-data">Sleep (h)</div>
            <Spark values={series.map((c) => c.sleepHours)} max={12} color="#5FA8D3" label={`Sleep over your last ${series.length} check-ins`} />
          </div>
        </div>
      )}
      {insight && <p className="mb-2 text-sm">{insight}</p>}
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
