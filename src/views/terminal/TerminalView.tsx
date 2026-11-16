// Shared level terminal: big-button check-in by unit number. No account, nothing stored,
// clears itself after every use (and after inactivity).
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { MoodIcon } from '../../components/MoodIcon'
import { Button, Explain, Sign, StateTag, Trust } from '../../components/ui'
import { activeWardenCount, sendCareToWardens } from '../../lib/care'
import { feedRegistry } from '../../lib/wardenRegistry'
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

const big = 'min-h-20 border-2 px-3 font-mono text-xl font-bold tracking-wider uppercase'
const off = 'border-hollow-700 bg-hollow-800 text-cream hover:border-lamp'
const on = 'border-lamp bg-lamp text-hollow-950'

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
        <div className="mb-3">
          <Sign sub="Set up this terminal">Select level</Sign>
        </div>
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
  /** How many vouched wardens the last note was encrypted to. */
  const [wardensTold, setWardensTold] = useState(0)
  const nodeRef = useRef<MeshNode | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastInput = useRef(Date.now())

  useEffect(() => {
    const node = new MeshNode({
      getInfo: () => {
        const w = getWorld()
        return { nodeId: `terminal-L${level}-${getDeviceId()}`, level, netUp: w ? isNetworkUp(w, level) : true }
      },
      // Learn the level's wardens and their vouches (signatures checked) so notes go only to real ones.
      onDeliver: (p) => feedRegistry(p.body),
    })
    nodeRef.current = node
    setTimeout(() => node.send({ kind: 'sync-req', requestId: `sync-term-${getDeviceId()}-${Date.now().toString(36)}`, want: ['wardens'] }), 200)
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
      setWardensTold(activeWardenCount(level))
      void sendCareToWardens(node, {
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
      aside={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <Trust>No account</Trust>
          <Trust>Nothing stored</Trust>
          <Trust>Clears after use</Trust>
        </span>
      }
    >
      <div className="mx-auto max-w-3xl space-y-3">
        <Sign sub="Shared terminal · daily check-in">Level {level} · terminal</Sign>
        <WarningBanner world={world} level={level} />
        <div className="grid grid-cols-6 gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <div key={s} className={`h-2 ${i < progress ? 'bg-lamp' : 'bg-hollow-800'}`} />
          ))}
        </div>

        {step === 'unit' && (
          <Panel title="Unit number" headingRef={headingRef}>
            <output aria-live="polite" className="mb-3 block border-2 border-hollow-700 bg-black py-3 text-center font-mono text-5xl tracking-[0.2em] text-lamp">
              {level}-{d.unit.padEnd(3, '_')}
            </output>
            <div className="grid grid-cols-3 gap-2">
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
              <button type="button" className={`${big} border-lamp bg-lamp text-hollow-950`} disabled={!d.unit} onClick={next}>
                Next
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Trust>Only your warden sees your unit</Trust>
              <Explain label="About this terminal">
                No account needed. Your unit number is sent — sealed — only to your block warden. Your answers count
                anonymously toward Level {level} on the public board. Nothing is kept on this terminal.
              </Explain>
            </div>
          </Panel>
        )}

        {step === 'okay' && (
          <Panel title={`Unit ${level}-${d.unit} · status`} headingRef={headingRef}>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`${big} min-h-36 border-lamp bg-lamp text-3xl text-hollow-950`} onClick={() => update({ okay: true })}>
                I'm okay
              </button>
              <button type="button" className={`${big} min-h-36 border-danger bg-black text-3xl text-danger`} onClick={() => update({ okay: false })}>
                I need help
              </button>
            </div>
          </Panel>
        )}

        {step === 'mood' && (
          <Panel title="Mood" headingRef={headingRef}>
            <div className="grid grid-cols-5 gap-2">
              {(['Very low', 'Low', 'Okay', 'Good', 'Great'] as const).map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={`${big} ${off} flex flex-col items-center justify-center gap-1 text-sm`}
                  onClick={() => update({ mood: (i + 1) as CheckIn['mood'] })}
                >
                  <MoodIcon value={i + 1} size={34} />
                  {label}
                </button>
              ))}
            </div>
          </Panel>
        )}

        {step === 'sleep' && (
          <Panel title="Sleep" headingRef={headingRef}>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Under 5 h', h: 4 },
                { label: '5–7 h', h: 6 },
                { label: '7 h +', h: 8 },
              ].map((o) => (
                <button key={o.h} type="button" className={`${big} ${off}`} onClick={() => update({ sleepHours: o.h })}>
                  {o.label}
                </button>
              ))}
            </div>
          </Panel>
        )}

        {step === 'symptoms' && (
          <Panel title="Symptoms · tap all" headingRef={headingRef}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SYMPTOMS.map((s) => {
                const sel = d.symptoms.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sel}
                    className={`${big} ${sel ? on : off}`}
                    onClick={() => update({ symptoms: sel ? d.symptoms.filter((x) => x !== s) : [...d.symptoms, s] }, false)}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <button type="button" className={`${big} mt-2 w-full border-lamp bg-lamp text-hollow-950`} onClick={next}>
              {d.symptoms.length ? 'Next' : 'None ▸'}
            </button>
          </Panel>
        )}

        {step === 'water' && (
          <Panel title="Water" headingRef={headingRef}>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className={`${big} ${off}`} onClick={() => submit('ok')}>
                Yes
              </button>
              <button type="button" className={`${big} ${off}`} onClick={() => submit('bad')}>
                Bad
              </button>
              <button type="button" className={`${big} ${off}`} onClick={() => submit('unsure')}>
                Unsure
              </button>
            </div>
          </Panel>
        )}

        {step === 'done' && (
          <Panel title={`Unit ${level}-${d.unit} · done`} headingRef={headingRef}>
            <StateTag state={d.okay ? 'normal' : 'danger'} className="text-3xl">
              {d.okay ? 'Checked in · okay' : wardensTold > 0 ? 'Warden told' : 'No vouched warden'}
            </StateTag>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Trust tone={wardensTold > 0 ? 'ok' : 'warn'}>
                {wardensTold > 0 ? `Sent privately to your warden${wardensTold > 1 ? 's' : ''}` : 'No trusted warden on this level yet'}
              </Trust>
              <Trust>Counted on the public board · no name</Trust>
              <Trust>Nothing kept here</Trust>
            </div>
            <button type="button" className={`${big} mt-3 w-full border-lamp bg-lamp text-hollow-950`} onClick={reset}>
              Finish · {countdown}
            </button>
          </Panel>
        )}

        {step !== 'unit' && step !== 'done' && (
          <Button tone="ghost" onClick={reset}>
            Cancel · clear
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
    <section className="border-2 border-hollow-700 bg-hollow-900">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="border-b-2 border-hollow-700 bg-hollow-950 px-3 py-2 font-mono text-lg font-bold tracking-[0.12em] text-lamp uppercase outline-none"
      >
        {title}
      </h2>
      <div className="p-3">{children}</div>
    </section>
  )
}
