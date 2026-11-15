// Daily check-in: one giant tap first, details after as one-tap choices. Saves ONE check-in with
// the same fields as before; "SEND NOW" at any point saves with what's chosen so far (defaults:
// mood 3, sleep 7 h, no symptoms, water OK — the same defaults the old form had).
import { useState } from 'react'
import { MoodIcon } from '../../components/MoodIcon'
import { Button, Explain, StateTag, Trust } from '../../components/ui'
import { SYMPTOMS, type CheckIn, type Symptom, type WaterReport } from '../../lib/db'
import { useResident } from '../../stores/residentStore'
import { tickLabel } from '../../sim/world'

type Step = 'mood' | 'sleep' | 'symptoms' | 'water'
const STEPS: Step[] = ['mood', 'sleep', 'symptoms', 'water']
const STEP_LABEL: Record<Step, string> = { mood: 'Mood', sleep: 'Sleep', symptoms: 'Symptoms', water: 'Water' }

const MOODS: { v: CheckIn['mood']; label: string }[] = [
  { v: 1, label: 'Very low' },
  { v: 2, label: 'Low' },
  { v: 3, label: 'Okay' },
  { v: 4, label: 'Good' },
  { v: 5, label: 'Great' },
]
const SLEEP = [
  { h: 4, label: 'Under 5 h' },
  { h: 5, label: '5–6 h' },
  { h: 7, label: '7–8 h' },
  { h: 9, label: '9 h +' },
]
const WATER: { v: WaterReport; label: string }[] = [
  { v: 'ok', label: 'OK' },
  { v: 'bad', label: 'Bad' },
  { v: 'unsure', label: 'Unsure' },
]

const choice = (on = false) =>
  `min-h-16 border-2 px-2 font-mono text-base font-bold tracking-wide uppercase ${
    on ? 'border-lamp bg-lamp text-hollow-950' : 'border-hollow-700 bg-hollow-800 text-cream hover:border-lamp'
  }`

export function CheckInFlow({ tick, onCheckedIn }: { tick: number; onCheckedIn?: (c: CheckIn) => void }) {
  const { profile, checkins, addCheckIn } = useResident()
  const last = checkins[0]
  const doneToday = last !== undefined && Math.floor(last.tick / 24) === Math.floor(tick / 24)

  const [step, setStep] = useState<Step | null>(null)
  const [okay, setOkay] = useState(true)
  const [mood, setMood] = useState<CheckIn['mood']>(3)
  const [sleepHours, setSleep] = useState(7)
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [updating, setUpdating] = useState(false)

  if (!profile) return null

  const start = (ok: boolean) => {
    setOkay(ok)
    setMood(3)
    setSleep(7)
    setSymptoms([])
    setStep('mood')
  }
  const next = () => setStep(STEPS[STEPS.indexOf(step ?? 'mood') + 1] ?? null)
  const send = async (water: WaterReport = 'ok') => {
    const c = await addCheckIn({ tick, ts: Date.now(), okay, mood, sleepHours, symptoms, water, level: profile.level })
    setStep(null)
    setUpdating(false)
    onCheckedIn?.(c)
  }

  // Details, one tap each.
  if (step) {
    const i = STEPS.indexOf(step)
    return (
      <section aria-label="Check-in details" className={`border-2 ${okay ? 'border-lamp' : 'border-danger'}`}>
        <header className="flex items-center justify-between gap-2 border-b-2 border-hollow-700 bg-hollow-950 px-3 py-1.5">
          <h2 className="font-mono text-xs font-bold tracking-[0.12em] text-lamp uppercase">
            {okay ? 'Okay' : 'Help request'} · {i + 1}/4 {STEP_LABEL[step]}
          </h2>
          {!okay && <StateTag state="danger">Family + warden told</StateTag>}
        </header>
        <div className="p-3">
          {step === 'mood' && (
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  aria-label={`Mood ${m.v}: ${m.label}`}
                  className={`${choice()} flex flex-col items-center justify-center gap-1 text-xs`}
                  onClick={() => {
                    setMood(m.v)
                    next()
                  }}
                >
                  <MoodIcon value={m.v} size={26} />
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {step === 'sleep' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SLEEP.map((s) => (
                <button
                  key={s.h}
                  type="button"
                  className={choice()}
                  onClick={() => {
                    setSleep(s.h)
                    next()
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {step === 'symptoms' && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SYMPTOMS.map((s) => {
                  const on = symptoms.includes(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      className={choice(on)}
                      onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s])}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              <Button tone="primary" className="mt-2 min-h-14 w-full" onClick={next}>
                {symptoms.length ? 'Next ▸' : 'None ▸'}
              </Button>
            </>
          )}
          {step === 'water' && (
            <div className="grid grid-cols-3 gap-2">
              {WATER.map((w) => (
                <button key={w.v} type="button" className={choice()} onClick={() => void send(w.v)}>
                  {w.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button tone="ghost" onClick={() => setStep(null)}>
              Cancel
            </Button>
            <Button tone="default" className="min-h-12 border-lamp text-lamp" onClick={() => void send()}>
              Send now ▸
            </Button>
          </div>
        </div>
      </section>
    )
  }

  // Already checked in today.
  if (doneToday && !updating) {
    return (
      <section aria-label="Today's check-in" className="border-2 border-hollow-700 bg-hollow-900 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StateTag state={last.okay ? 'normal' : 'danger'} className="text-base">
            {last.okay ? 'Checked in · okay' : 'Help requested'}
          </StateTag>
          <Button tone="ghost" onClick={() => setUpdating(true)}>
            Update
          </Button>
        </div>
        <div className="mt-1 font-mono text-xs tracking-wider text-hollow-300 uppercase">
          {tickLabel(last.tick)} · mood {last.mood} · sleep {last.sleepHours} h ·{' '}
          {last.symptoms.length ? last.symptoms.join(', ') : 'no symptoms'} · water {last.water}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Trust>Stored on this device</Trust>
          <Trust>Ledger: counts only</Trust>
        </div>
      </section>
    )
  }

  // The one primary action.
  return (
    <section aria-label="Daily check-in" className="space-y-2">
      <button
        type="button"
        onClick={() => start(true)}
        className="block min-h-28 w-full border-4 border-lamp bg-lamp font-mono text-4xl font-bold tracking-[0.08em] text-hollow-950 uppercase hover:bg-[#ffb54d] sm:text-5xl"
      >
        I'm okay
      </button>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => start(false)}
          className="min-h-14 flex-1 border-2 border-danger bg-hollow-950 font-mono text-lg font-bold tracking-wider text-danger uppercase hover:bg-danger/15"
        >
          I need help
        </button>
        {updating && (
          <Button tone="ghost" onClick={() => setUpdating(false)}>
            Cancel
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Trust>Stored on this device</Trust>
          <Trust>Ledger: counts only</Trust>
        </div>
        <Explain label="What happens to my check-in">
          Your answers stay on this phone. Your family sees only okay / need help (encrypted with your family code). The
          public ledger receives anonymous counts for Level {profile.level} — no name, unit or device id. Asking for help
          also tells your block warden your unit number, so someone can come to you.
        </Explain>
      </div>
    </section>
  )
}
