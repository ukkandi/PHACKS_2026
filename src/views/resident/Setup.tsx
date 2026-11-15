import { useState, type FormEvent } from 'react'
import { Button, Sign, Trust } from '../../components/ui'
import { useResident } from '../../stores/residentStore'
import { LEVEL_COUNT } from '../../sim/types'

// Demo presets: one family spread across three levels. `?as=mara` on /resident picks one directly.
export const PRESETS = [
  { key: 'mara', name: 'Mara', level: 38, unit: '38-114' },
  { key: 'teo', name: 'Teo', level: 36, unit: '36-207' },
  { key: 'ilan', name: 'Ilan', level: 12, unit: '12-031' },
]
export const DEMO_FAMILY = 'ORIN-7'

const input = 'min-h-12 w-full border-2 border-hollow-700 bg-hollow-950 px-3 font-mono text-cream'

export function Setup() {
  const saveProfile = useResident((s) => s.saveProfile)
  const [name, setName] = useState('')
  const [level, setLevel] = useState(20)
  const [unit, setUnit] = useState('')
  const [familyCode, setFamilyCode] = useState(DEMO_FAMILY)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    void saveProfile({ name: name.trim(), level, unit: unit.trim() || `${level}-000`, familyCode: familyCode.trim().toUpperCase() })
  }

  return (
    <div className="mx-auto max-w-md space-y-3">
      <Sign sub="Set up this device">New device</Sign>
      <Trust>Stored on this device only</Trust>
      <div className="font-mono text-[11px] tracking-[0.15em] text-hollow-300 uppercase">Demo family {DEMO_FAMILY}</div>
      <div className="grid gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.name}
            className="min-h-14 text-base"
            onClick={() => void saveProfile({ name: p.name, level: p.level, unit: p.unit, familyCode: DEMO_FAMILY })}
          >
            {p.name} · L{p.level}
          </Button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-2 border-2 border-hollow-700 p-3">
        <label className="block text-xs uppercase">
          Name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs uppercase">
            Level
            <select className={input} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Level {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs uppercase">
            Unit
            <input className={input} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={`${level}-000`} />
          </label>
        </div>
        <label className="block text-xs uppercase">
          Family code
          <input className={input} value={familyCode} onChange={(e) => setFamilyCode(e.target.value)} />
        </label>
        <Button type="submit" tone="primary" className="min-h-14 w-full">
          Start
        </Button>
      </form>
    </div>
  )
}
