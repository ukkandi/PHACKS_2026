import { useState, type FormEvent } from 'react'
import { Button, Card } from '../../components/ui'
import { useResident } from '../../stores/residentStore'
import { LEVEL_COUNT } from '../../sim/types'

// Demo presets: one family spread across three levels. `?as=mara` on /resident picks one directly.
export const PRESETS = [
  { key: 'mara', name: 'Mara', level: 38, unit: '38-114' },
  { key: 'teo', name: 'Teo', level: 36, unit: '36-207' },
  { key: 'ilan', name: 'Ilan', level: 12, unit: '12-031' },
]
export const DEMO_FAMILY = 'ORIN-7'

const input = 'min-h-11 w-full rounded-lg border border-hollow-700 bg-hollow-800 px-3 text-cream'

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
    <div className="mx-auto max-w-md space-y-4">
      <Card title="Set up this device">
        <p className="mb-4 text-sm text-hollow-300">
          Your details stay on this device. Lantern only ever shares anonymous level totals — and your
          status with your family, encrypted with your family code.
        </p>
        <div className="mb-4">
          <div className="mb-2 text-xs text-hollow-500 uppercase">Demo family “{DEMO_FAMILY}”</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.name}
                onClick={() => void saveProfile({ name: p.name, level: p.level, unit: p.unit, familyCode: DEMO_FAMILY })}
              >
                {p.name} · L{p.level}
              </Button>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            Name (only your family sees it)
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Level
              <select className={input} value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                {Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Level {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Unit
              <input className={input} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={`${level}-000`} />
            </label>
          </div>
          <label className="block text-sm">
            Family code (shared secret)
            <input className={input} value={familyCode} onChange={(e) => setFamilyCode(e.target.value)} />
          </label>
          <Button type="submit" tone="primary" className="w-full">
            Start
          </Button>
        </form>
      </Card>
    </div>
  )
}
