import { useState } from 'react'
import { Button } from '../../components/ui'
import { SYMPTOMS, type CheckIn, type Symptom, type WaterReport } from '../../lib/db'
import type { OnBehalf } from '../../stores/wardenStore'

const chip = (on: boolean) =>
  `min-h-12 border-2 px-3 font-mono text-sm font-bold uppercase ${on ? 'border-lamp bg-lamp text-hollow-950' : 'border-hollow-700 bg-hollow-800 text-cream'}`

/** Compact check-in a warden fills in face to face for someone without a device. */
export function OnBehalfForm({ name, onSubmit, onCancel }: { name: string; onSubmit: (c: OnBehalf) => void; onCancel: () => void }) {
  const [okay, setOkay] = useState(true)
  const [mood, setMood] = useState<CheckIn['mood']>(3)
  const [sleepHours, setSleep] = useState(7)
  const [symptoms, setSymptoms] = useState<Symptom[]>([])
  const [water, setWater] = useState<WaterReport>('ok')
  return (
    <form
      className="mt-2 space-y-3 border-2 border-lamp bg-hollow-950 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ okay, mood, sleepHours, symptoms, water })
      }}
      aria-label={`Check in for ${name}`}
    >
      <div className="font-mono text-xs font-bold tracking-[0.12em] text-lamp uppercase">Check in · {name}</div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Status</legend>
        <button type="button" aria-pressed={okay} className={chip(okay)} onClick={() => setOkay(true)}>
          Okay
        </button>
        <button type="button" aria-pressed={!okay} className={chip(!okay)} onClick={() => setOkay(false)}>
          Needs help
        </button>
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-1 font-mono text-sm tracking-[0.15em] text-hollow-300 uppercase">Mood</legend>
        {([1, 2, 3, 4, 5] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mood === m} aria-label={`Mood ${m}`} className={chip(mood === m)} onClick={() => setMood(m)}>
            {m}
          </button>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 font-mono text-xs uppercase">
        Sleep h
        <input
          type="number"
          min={0}
          max={14}
          value={sleepHours}
          onChange={(e) => setSleep(Math.max(0, Math.min(14, Number(e.target.value))))}
          className="min-h-12 w-20 border-2 border-hollow-700 bg-hollow-800 px-2 font-mono"
        />
      </label>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 font-mono text-sm tracking-[0.15em] text-hollow-300 uppercase">Symptoms</legend>
        {SYMPTOMS.map((s) => {
          const on = symptoms.includes(s)
          return (
            <button key={s} type="button" aria-pressed={on} className={chip(on)} onClick={() => setSymptoms(on ? symptoms.filter((x) => x !== s) : [...symptoms, s])}>
              {s}
            </button>
          )
        })}
      </fieldset>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 font-mono text-sm tracking-[0.15em] text-hollow-300 uppercase">Water</legend>
        {(['ok', 'bad', 'unsure'] as const).map((w) => (
          <button key={w} type="button" aria-pressed={water === w} className={chip(water === w)} onClick={() => setWater(w)}>
            {w}
          </button>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" tone="primary" className="min-h-12">
          Send
        </Button>
        <Button tone="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
