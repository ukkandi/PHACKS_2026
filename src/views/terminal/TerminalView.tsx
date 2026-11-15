// Shared level terminal: big-button check-in by unit number. No account, nothing stored,
// clears itself after every use (and after inactivity).
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { Button } from '../../components/ui'
import { sendCare } from '../../lib/care'
import { SYMPTOMS, type CheckIn, type Symptom, type WaterReport } from '../../lib/db'
import { getDeviceId } from '../../lib/device'
import { MeshNode } from '../../lib/mesh'
import { countsFromCheckIn } from '../../lib/reports'
import { getWorld, useWorld } from '../../lib/worldFeed'
import { LEVEL_COUNT } from '../../sim/types'
import { isNetworkUp } from '../../sim/world'
import { WarningBanner } from '../resident/WarningBanner'

type Step = 'unit' | 'okay' | 'mood' | 'sleep' | 'symptoms' | 'water' | 'done'
const STEPS: Step[] = ['unit', 'okay', 'mood', 'sleep', 'symptoms', 'water']
const IDLE_MS = 45_000
const DONE_MS = 8_000

interface Draft {
  unit: string
  okay: boolean
  mood: CheckIn['mood']
  sleepHours: number
  symptoms: Symptom[]
  water: WaterReport
}

const EMPTY: Draft = { unit: '', okay: true, mood: 3, sleepHours: 7, symptoms: [], water: 'ok' }

const big = 'min-h-20 rounded-2xl border-2 px-4 text-xl font-semibold transition focus-visible:outline-4'
const off = 'border-hollow-700 bg-hollow-800 text-white hover:border-lamp'
const on = 'border-lamp bg-lamp/20 text-lamp'

export function TerminalView() {
  const [params, setParams] = useSearchParams()
  const level = Number(params.get('level'))
  const valid = level >= 1 && level <= LEVEL_COUNT

  useEffect(() => {
    document.title = valid ? `Level ${level} terminal — Lantern` : 'Level terminal — Lantern'
  }, [level, valid])

  if (!valid) {
    return (
      <Shell view="level terminal">
        <h1 className="mb-4 text-2xl font-bold">Which level is this terminal on?</h1>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
          {Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={`${big} ${off}`} onClick={() => setParams({ level: String(n) })}>
              {n}
            </button>
          ))}
        </div>
      </Shell>
    )
  }
  return <Terminal level={level} />
}

function Terminal({ level }: { level: number }) {
  const world = useWorld()
  const [step, setStep] = useState<Step>('unit')
  const [d, setD] = useState<Draft>(EMPTY)
  const [countdown, setCountdown] = useState(0)
  const nodeRef = useRef<MeshNode | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastInput = useRef(Date.now())

  useEffect(() => {
    const node = new MeshNode({
      getInfo: () => {
        const w = getWorld()
        return { nodeId: `terminal-L${level}-${getDeviceId()}`, level, netUp: w ? isNetworkUp(w, level) : true }
      },
    })
    nodeRef.current = node
    return () => node.close()
  }, [level])

  const reset = useCallback(() => {
    setD(EMPTY)
    setStep('unit')
    setCountdown(0)
  }, [])

  // Move focus to the question on every step (keyboard + screen-reader users).
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  // Auto-clear: after finishing, and if someone walks away mid-way.
  useEffect(() => {
    const t = setInterval(() => {
      if (step === 'done') {
        setCountdown((c) => {
          if (c <= 1) {
            reset()
            return 0
          }
          return c - 1
        })
      } else if ((step !== 'unit' || d.unit) && Date.now() - lastInput.current > IDLE_MS) {
        reset()
      }
    }, 1000)
    return () => clearInterval(t)
  }, [step, d.unit, reset])

  const touch = () => {
    lastInput.current = Date.now()
  }
  const next = () => {
    touch()
    setStep(STEPS[STEPS.indexOf(step) + 1] ?? 'done')
  }
  const update = (patch: Partial<Draft>, advance = true) => {
    setD((cur) => ({ ...cur, ...patch }))
    if (advance) next()
    else touch()
  }

  const submit = (water: WaterReport) => {
    const final = { ...d, water }
    setD(final)
    const tick = getWorld()?.tick ?? 0
    const node = nodeRef.current
    if (node) {
      node.send(
        { kind: 'summary', level, tick, source: 'terminal', counts: countsFromCheckIn({ ...final }) },
        { anonymous: true },
      )
      void sendCare(node, {
        type: 'care',
        level,
        unit: `${level}-${final.unit}`,
        okay: final.okay,
        symptoms: final.symptoms,
        mood: final.mood,
        tick,
        via: 'terminal',
      })
    }
    setStep('done')
    setCountdown(DONE_MS / 1000)
  }

  // Physical keyboard support for the unit keypad.
  useEffect(() => {
    if (step !== 'unit') return
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setD((cur) => ({ ...cur, unit: (cur.unit + e.key).slice(0, 4) }))
      else if (e.key === 'Backspace') setD((cur) => ({ ...cur, unit: cur.unit.slice(0, -1) }))
      else if (e.key === 'Enter' && d.unit.length >= 1) setStep('okay')
      else return
      lastInput.current = Date.now()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, d.unit])

  const progress = step === 'done' ? STEPS.length : STEPS.indexOf(step)

  return (
    <Shell
      view={`Level ${level} terminal`}
      aside={<span className="text-sm text-hollow-300">Shared terminal · no account · clears after use</span>}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <WarningBanner world={world} level={level} />
        <div className="h-2 rounded bg-hollow-800" aria-hidden>
          <div className="h-2 rounded bg-lamp transition-all" style={{ width: `${(progress / STEPS.length) * 100}%` }} />
        </div>

        {step === 'unit' && (
          <Panel title="Daily check-in — enter your unit number" headingRef={headingRef}>
            <output aria-live="polite" className="mb-4 block text-center font-mono text-5xl tracking-widest">
              {level}-{d.unit.padEnd(3, '_')}
            </output>
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                <button key={k} type="button" className={`${big} ${off} text-3xl`} onClick={() => update({ unit: (d.unit + k).slice(0, 4) }, false)}>
                  {k}
                </button>
              ))}
              <button type="button" aria-label="Delete last digit" className={`${big} ${off}`} onClick={() => update({ unit: d.unit.slice(0, -1) }, false)}>
                ⌫
              </button>
              <button type="button" className={`${big} ${off} text-3xl`} onClick={() => update({ unit: (d.unit + '0').slice(0, 4) }, false)}>
                0
              </button>
              <button type="button" className={`${big} ${on}`} disabled={!d.unit} onClick={next}>
                Next
              </button>
            </div>
            <p className="mt-3 text-sm text-hollow-500">
              No account needed. Your unit number is only shared — sealed — with your block warden.
            </p>
          </Panel>
        )}

        {step === 'okay' && (
          <Panel title={`Unit ${level}-${d.unit}: how are you?`} headingRef={headingRef}>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={`${big} min-h-32 border-ok/60 bg-ok/10 text-2xl text-ok`} onClick={() => update({ okay: true })}>
                I'm okay
              </button>
              <button type="button" className={`${big} min-h-32 border-danger/60 bg-danger/10 text-2xl text-danger`} onClick={() => update({ okay: false })}>
                I need help
              </button>
            </div>
          </Panel>
        )}

        {step === 'mood' && (
          <Panel title="Your mood today" headingRef={headingRef}>
            <div className="grid grid-cols-5 gap-2">
              {(['Very low', 'Low', 'Okay', 'Good', 'Great'] as const).map((label, i) => (
                <button key={label} type="button" className={`${big} ${off} flex flex-col items-center justify-center`} onClick={() => update({ mood: (i + 1) as CheckIn['mood'] })}>
                  <span className="text-3xl" aria-hidden>
                    {['◔', '◑', '◕', '●', '✺'][i]}
                  </span>
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {step === 'sleep' && (
          <Panel title="Sleep last night" headingRef={headingRef}>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Under 5 hours', h: 4 },
                { label: '5 to 7 hours', h: 6 },
                { label: '7 hours or more', h: 8 },
              ].map((o) => (
                <button key={o.h} type="button" className={`${big} ${off}`} onClick={() => update({ sleepHours: o.h })}>
                  {o.label}
                </button>
              ))}
            </div>
          </Panel>
        )}

        {step === 'symptoms' && (
          <Panel title="Any of these? Tap all that apply" headingRef={headingRef}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SYMPTOMS.map((s) => {
                const sel = d.symptoms.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sel}
                    className={`${big} ${sel ? on : off} capitalize`}
                    onClick={() => update({ symptoms: sel ? d.symptoms.filter((x) => x !== s) : [...d.symptoms, s] }, false)}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <Button tone="primary" className="mt-4 min-h-16 w-full text-xl" onClick={next}>
              {d.symptoms.length ? 'Next' : 'None of these — next'}
            </Button>
          </Panel>
        )}

        {step === 'water' && (
          <Panel title="Is your water okay today?" headingRef={headingRef}>
            <div className="grid grid-cols-3 gap-3">
              <button type="button" className={`${big} ${off}`} onClick={() => submit('ok')}>
                Yes
              </button>
              <button type="button" className={`${big} ${off}`} onClick={() => submit('bad')}>
                Tastes / smells bad
              </button>
              <button type="button" className={`${big} ${off}`} onClick={() => submit('unsure')}>
                Not sure
              </button>
            </div>
          </Panel>
        )}

        {step === 'done' && (
          <Panel title={`Thank you, unit ${level}-${d.unit}`} headingRef={headingRef}>
            <p className="text-xl">
              {d.okay ? 'You are checked in as okay.' : 'Your block warden has been told you need help.'}
            </p>
            <p className="mt-2 text-hollow-300">
              Your check-in counts — anonymously — toward Level {level}'s numbers on the public ledger. Nothing is kept on
              this terminal.
            </p>
            <Button tone="primary" className="mt-4 min-h-16 w-full text-xl" onClick={reset}>
              Finish ({countdown}s)
            </Button>
          </Panel>
        )}

        {step !== 'unit' && step !== 'done' && (
          <Button tone="ghost" onClick={reset}>
            Cancel and clear
          </Button>
        )}
      </div>
    </Shell>
  )
}

function Panel({
  title,
  children,
  headingRef,
}: {
  title: string
  children: ReactNode
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <section className="rounded-2xl border border-hollow-700 bg-hollow-900 p-5">
      <h1 ref={headingRef} tabIndex={-1} className="mb-4 text-2xl font-bold outline-none">
        {title}
      </h1>
      {children}
    </section>
  )
}
