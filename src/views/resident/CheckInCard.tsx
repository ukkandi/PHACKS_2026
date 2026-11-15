import { useState } from 'react'
import { Button, Card } from '../../components/ui'
import { SYMPTOMS, type CheckIn, type Symptom, type WaterReport } from '../../lib/db'
import { useResident } from '../../stores/residentStore'
import { tickLabel } from '../../sim/world'

const MOODS: { v: CheckIn['mood']; label: string; glyph: string }[] = [
  { v: 1, label: 'Very low', glyph: '◔' },
  { v: 2, label: 'Low', glyph: '◑' },
  { v: 3, label: 'Okay', glyph: '◕' },
  { v: 4, label: 'Good', glyph: '●' },
  { v: 5, label: 'Great', glyph: '✺' },
]

const WATER: { v: WaterReport; label: string }[] = [
  { v: 'ok', label: 'Water OK' },
  { v: 'bad', label: 'Tastes / smells bad' },
  { v: 'unsure', label: 'Not sure' },
]

const chip = (on: boolean) =>
  `min-h-11 rounded-lg border px-3 text-sm ${on ? 'border-lamp bg-lamp/15 text-lamp' : 'border-hollow-700 bg-hollow-800 text-hollow-300'}`

export function CheckInCard({ tick, onCheckedIn }: { tick: number; onCheckedIn?: (c: CheckIn) => void }) {
  const { profile, checkins, addCheckIn } = useResident()
  const last = checkins[0]
  const today = Math.floor(tick / 24)
  const doneToday = last !== undefined && Math.floor(last.tick / 24) === today
  const [editing, setEditing] = useState(false)

  const [okay, setOkay] = useState(true)
  const [mood, setMood] = useState<CheckIn['mood']>(3)
  const [sleep, setSleep] = useState(7)
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [water, setWater] = useState<WaterReport>('ok')

  if (!profile) return null

  if (doneToday && !editing) {
    return (
      <Card title="Today's check-in" right={<span className="text-xs text-ok">✓ done</span>}>
        <p className="text-lg">
          {last.okay ? "You're checked in as okay." : 'You asked for help. Your family and warden can see that.'}
        </p>
        <p className="mt-1 text-sm text-hollow-300">
          {tickLabel(last.tick)} · mood {last.mood}/5 · slept {last.sleepHours}h ·{' '}
          {last.symptoms.length ? last.symptoms.join(', ') : 'no symptoms'} · water {last.water}
        </p>
        <Button className="mt-3" tone="ghost" onClick={() => setEditing(true)}>
          Update check-in
        </Button>
      </Card>
    )
  }

  const submit = async () => {
    const c = await addCheckIn({
      tick,
      ts: Date.now(),
      okay,
      mood,
      sleepHours: sleep,
      symptoms,
      water,
      level: profile.level,
    })
    setEditing(false)
    onCheckedIn?.(c)
  }

  return (
    <Card title="Daily check-in">
      <fieldset className="mb-4">
        <legend className="mb-2 text-sm text-hollow-300">How are you?</legend>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={okay} className={`${chip(okay)} min-h-14 text-base`} onClick={() => setOkay(true)}>
            I'm okay
          </button>
          <button
            type="button"
            aria-pressed={!okay}
            className={`min-h-14 rounded-lg border px-3 text-base ${!okay ? 'border-danger bg-danger/15 text-danger' : 'border-hollow-700 bg-hollow-800 text-hollow-300'}`}
            onClick={() => setOkay(false)}
          >
            I need help
          </button>
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-2 text-sm text-hollow-300">Mood</legend>
        <div className="grid grid-cols-5 gap-2">
          {MOODS.map((m) => (
            <button
              key={m.v}
              type="button"
              aria-pressed={mood === m.v}
              aria-label={`Mood ${m.v}: ${m.label}`}
              className={`${chip(mood === m.v)} flex flex-col items-center py-1`}
              onClick={() => setMood(m.v)}
            >
              <span aria-hidden className="text-lg">
                {m.glyph}
              </span>
              <span className="text-[11px]">{m.label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-2 text-sm text-hollow-300">Sleep last night</legend>
        <div className="flex items-center gap-3">
          <Button aria-label="Less sleep" onClick={() => setSleep((s) => Math.max(0, s - 1))}>
            −
          </Button>
          <output className="w-16 text-center text-2xl font-semibold" aria-live="polite">
            {sleep}h
          </output>
          <Button aria-label="More sleep" onClick={() => setSleep((s) => Math.min(14, s + 1))}>
            +
          </Button>
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-2 text-sm text-hollow-300">Any symptoms?</legend>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => {
            const on = symptoms.includes(s)
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                className={chip(on)}
                onClick={() => setSymptoms((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]))}
              >
                {s}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-2 text-sm text-hollow-300">Water today</legend>
        <div className="flex flex-wrap gap-2">
          {WATER.map((w) => (
            <button key={w.v} type="button" aria-pressed={water === w.v} className={chip(water === w.v)} onClick={() => setWater(w.v)}>
              {w.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Button tone="primary" className="min-h-14 w-full text-base" onClick={() => void submit()}>
        Check in
      </Button>
    </Card>
  )
}
