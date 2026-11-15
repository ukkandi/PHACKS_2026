import { Card, Trust } from '../../components/ui'
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
      <path d={d} fill="none" stroke={color} strokeWidth={2} />
      {values.map((v, i) => (
        <rect key={i} x={x(i) - 2} y={y(v) - 2} width={4} height={4} fill={color} />
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
    <Card
      title="Your trend"
      right={<Trust>Stored on this device</Trust>}
      help={insight ?? 'After a few check-ins with different amounts of sleep, Lantern shows how sleep and mood move together — computed on this phone only.'}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="font-mono text-sm tracking-[0.15em] text-hollow-300 uppercase">Mood · avg</div>
          <div className="font-mono text-2xl font-bold text-lamp">{avgMood.toFixed(1)}<span className="text-sm text-hollow-500">/5</span></div>
          {series.length >= 2 && <Spark values={series.map((c) => c.mood)} max={5} color="#F2A33A" label={`Mood over your last ${series.length} check-ins`} />}
        </div>
        <div>
          <div className="font-mono text-sm tracking-[0.15em] text-hollow-300 uppercase">Sleep · avg</div>
          <div className="font-mono text-2xl font-bold text-data">{avgSleep.toFixed(1)}<span className="text-sm text-hollow-500"> h</span></div>
          {series.length >= 2 && <Spark values={series.map((c) => c.sleepHours)} max={12} color="#5FA8D3" label={`Sleep over your last ${series.length} check-ins`} />}
        </div>
      </div>
      <ul className="mt-2 space-y-0.5 font-mono text-sm uppercase">
        {recent.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            <span className="w-24 text-hollow-500">{tickLabel(c.tick)}</span>
            <span className={c.okay ? 'text-ok' : 'text-danger'}>{c.okay ? 'okay' : 'help'}</span>
            <span className="text-hollow-300">m{c.mood}</span>
            <span className="text-hollow-300">{c.sleepHours}h</span>
            <span className="truncate text-hollow-500">{c.symptoms.join(', ')}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
