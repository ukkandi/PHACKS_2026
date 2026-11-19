// DEMO-ONLY: /stage — a hands-free, 16:9 autopilot of the demo for screen recording (≤ 1:55).
// Real app pages run in same-origin frames (so the phone-to-phone mesh works as with tabs); the
// script in ./show.ts clicks their buttons. A narrator, generated sound design and a blackout
// countdown sit on top. One click on PLAY unlocks sound.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorld } from '../../lib/worldFeed'
import { predictBlackout } from '../../sim/predict'
import { StageAudio } from './audio'
import { Director } from './director'
import { Aborted, prepareWorld, runShow, type Clock, type FrameName, type StageApi } from './show'
import './stage.css'

const W = 1920
const H = 1080
const PHONE = { w: 344, h: 700, scale: 1.08 }
const BOARD = { w: 840, h: 652, scale: 1.16 }

const SRC: Record<FrameName, string> = {
  mara: '/resident?device=mara&as=mara',
  ilan: '/resident?device=ilan&as=ilan',
  board: '/ledger?device=board',
  sim: '/sim',
  warden: '/warden?level=38&device=warden38',
}

const CHAPTERS = ['Check-in', 'Warning', 'Blackout', 'Message', 'Outbreak', 'Allocation', 'Warden']

type Phase = 'preparing' | 'ready' | 'playing' | 'paused' | 'done'

interface StageWindow extends Window {
  __lanternStage?: { speak: (text: string, urgent: boolean) => void }
  __stageLog?: { name: string; ok: boolean; detail?: string }[]
  __stageSpoken?: string[]
  __stageNarration?: unknown[]
  __stageDone?: boolean
  __stageRunMs?: number
  __stageVoices?: { narrator: string; phone: string; recordedLines: number }
}

function useFit() {
  const [s, setS] = useState(1)
  useEffect(() => {
    const on = () => setS(Math.min(window.innerWidth / W, window.innerHeight / H))
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return s
}

export default function StageView() {
  const scale = useFit()
  const frames = useRef<Partial<Record<FrameName, HTMLIFrameElement | null>>>({})
  const speed = Math.max(0.25, Number(new URLSearchParams(location.search).get('speed')) || 1)
  const clock = useRef<Clock>({ speed, paused: false, gen: 0 })
  const audio = useRef(new StageAudio())
  const director = useRef(new Director())
  const [phase, setPhase] = useState<Phase>('preparing')
  const [beat, setBeat] = useState<{ chapter: string; caption: string; focus: FrameName[] }>({ chapter: '', caption: '', focus: [] })
  const [card, setCard] = useState<'title' | 'closing' | null>(null)
  const [black, setBlack] = useState(false)
  const [countdownOn, setCountdownOn] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const prepared = useRef(false)
  const w = window as StageWindow

  // Narrator + phone voices; the framed phones hand their speech to us (see alertFeed.speak).
  useEffect(() => {
    document.title = 'Lantern — works in the dark (stage)'
    director.current.speed = speed
    w.__stageSpoken = []
    w.__lanternStage = { speak: (text) => director.current.phone(text) }
    return () => {
      delete w.__lanternStage
    }
  }, [w, speed])

  // Get the world ready as soon as the page opens, so PLAY starts on a clean, ready demo.
  useEffect(() => {
    let live = true
    void (async () => {
      await new Promise((r) => setTimeout(r, 1500))
      await director.current.prepare()
      const ok = await prepareWorld((n) => frames.current[n] ?? null, () => live)
      if (!live) return
      prepared.current = ok
      setPhase('ready')
    })()
    return () => {
      live = false
    }
  }, [])

  // Countdown: hours until Level 38's feeder fails, from the live world; only ever ticks down.
  const world = useWorld()
  const cd = useRef<{ shown: number | null; initial: number; tick: number }>({ shown: null, initial: 1, tick: 0 })
  useEffect(() => {
    if (!countdownOn) {
      cd.current = { shown: null, initial: 1, tick: 0 }
      setCountdown(null)
      return
    }
    const l = world?.levels[37]
    if (!world || !l || l.blackout) return
    const p = predictBlackout(l.loadHistory, { temperature: l.temperature })
    const est = p.hoursToFailure ?? p.hoursRange?.[0]
    if (est === undefined || est === null) return
    const e = Math.max(1, Math.ceil(est))
    const c = cd.current
    if (c.shown === null) cd.current = { shown: e, initial: e, tick: world.tick }
    else if (world.tick > c.tick) {
      // Tick down 1 h per simulated hour; follow a sharper forecast, but never drop more than 2 h per hour.
      const k = world.tick - c.tick
      cd.current = { ...c, shown: Math.max(1, c.shown - 2 * k, Math.min(c.shown - k, e)), tick: world.tick }
    }
    const shown = cd.current.shown!
    setCountdown(shown)
    audio.current.tension(1 - (shown - 1) / Math.max(1, cd.current.initial - 1))
  }, [world, countdownOn])

  const play = useCallback(() => {
    // Inside the click: unlock speech and Web Audio.
    director.current.unlock()
    audio.current.unlock()
    clock.current.gen++
    clock.current.paused = false
    w.__stageLog = []
    w.__stageSpoken = []
    w.__stageNarration = []
    w.__stageDone = false
    w.__stageVoices = { ...director.current.voiceNames, recordedLines: director.current.recordedLines }
    const wasPrepared = prepared.current
    prepared.current = false
    const t0 = performance.now()
    setPhase('playing')
    const api: StageApi = {
      frame: (n) => frames.current[n] ?? null,
      setBeat: (chapter, caption, focus) => setBeat({ chapter, caption, focus }),
      setCard,
      setBlack,
      setCountdown: (on) => setCountdownOn(on),
      countdown: () => cd.current.shown,
      director: director.current,
      audio: audio.current,
      check: (name, ok, detail) => w.__stageLog!.push({ name, ok, detail }),
    }
    runShow(api, clock.current, wasPrepared)
      .then(() => {
        w.__stageRunMs = Math.round(performance.now() - t0)
        w.__stageDone = true
        audio.current.stopDrone()
        setPhase('done')
      })
      .catch((e) => {
        if (!(e instanceof Aborted)) {
          console.error(e)
          setPhase('done')
        }
      })
  }, [w])

  const togglePause = useCallback(() => {
    const c = clock.current
    c.paused = !c.paused
    if (c.paused) {
      director.current.pause()
      audio.current.suspend()
    } else {
      director.current.resume()
      audio.current.resume()
    }
    setPhase(c.paused ? 'paused' : 'playing')
  }, [])

  const restart = useCallback(() => {
    clock.current.gen++
    director.current.stop()
    audio.current.stopDrone()
    setCard(null)
    setBlack(false)
    setCountdownOn(false)
    play()
  }, [play])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        if (phase === 'ready') play()
        else if (phase === 'done') restart()
        else if (phase !== 'preparing') togglePause()
      } else if ((e.key === 'r' || e.key === 'R') && phase !== 'preparing') restart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, play, togglePause, restart])

  const chapterIdx = CHAPTERS.indexOf(beat.chapter)
  const focused = (n: FrameName) => beat.focus.includes(n)

  const frame = (n: FrameName, size: { w: number; h: number; scale: number }, label: string) => (
    <figure className="m-0">
      <figcaption className={`mb-2 font-mono text-base font-bold tracking-[0.15em] uppercase ${focused(n) ? 'text-lamp' : 'text-hollow-500'}`}>
        {label}
      </figcaption>
      <div className={`border-4 bg-black p-2 transition-colors duration-500 ${focused(n) ? 'border-lamp' : 'border-hollow-700'}`}>
        <div style={{ width: size.w * size.scale, height: size.h * size.scale }} className="overflow-hidden">
          <iframe
            title={label}
            src={SRC[n]}
            ref={(el) => {
              frames.current[n] = el
            }}
            style={{ width: size.w, height: size.h, transform: `scale(${size.scale})`, transformOrigin: 'top left', border: 0 }}
          />
        </div>
      </div>
    </figure>
  )

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div
        className="absolute bg-hollow-950"
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left', left: (window.innerWidth - W * scale) / 2, top: (window.innerHeight - H * scale) / 2 }}
      >
        {/* Top bar: chapter rail + controls */}
        <header className="absolute inset-x-0 top-0 flex h-14 items-center justify-between border-b-2 border-hollow-800 px-9">
          <div className="font-mono text-base font-bold tracking-[0.2em] text-lamp uppercase">
            Lantern <span className="font-normal text-hollow-500">// the Hollow · live</span>
          </div>
          <ol className="flex gap-1" aria-label="Demo chapters">
            {CHAPTERS.map((c, i) => (
              <li
                key={c}
                className={`px-2 py-1 font-mono text-xs tracking-wider uppercase ${
                  i === chapterIdx ? 'bg-lamp font-bold text-hollow-950' : i < chapterIdx ? 'text-hollow-300' : 'text-hollow-700'
                }`}
              >
                {c}
              </li>
            ))}
          </ol>
          <div className={`flex gap-2 transition-opacity ${phase === 'playing' ? 'opacity-10 hover:opacity-100' : ''}`}>
            {phase === 'playing' || phase === 'paused' ? (
              <button type="button" onClick={togglePause} className="border-2 border-hollow-500 px-3 py-1 font-mono text-sm font-bold uppercase">
                {phase === 'paused' ? '▶ Resume' : '❚❚ Pause'}
              </button>
            ) : null}
            {phase !== 'preparing' && phase !== 'ready' && (
              <button type="button" onClick={restart} className="border-2 border-hollow-500 px-3 py-1 font-mono text-sm font-bold uppercase">
                ↺ Restart
              </button>
            )}
          </div>
        </header>

        {/* Phones + public board */}
        <main className="absolute flex gap-8" style={{ top: 72, left: 36 }}>
          <div className="flex gap-6">
            {frame('mara', PHONE, 'Mara · Level 38')}
            {frame('ilan', PHONE, 'Ilan · Level 12')}
          </div>
          {frame('board', BOARD, 'Public board · all levels')}
        </main>

        {/* Countdown to the blackout, ticking with the simulated clock */}
        {countdownOn && countdown !== null && (
          <div role="status" className="absolute z-10 border-4 border-danger bg-black" style={{ top: 64, left: '50%', transform: 'translateX(-50%)' }}>
            <div className="hazard h-2" aria-hidden />
            <div className="px-8 py-2 font-mono text-[40px] font-bold tracking-[0.12em] text-danger uppercase">
              ▲ L38 · Blackout in ~{countdown}h
            </div>
          </div>
        )}

        {/* Caption */}
        <section aria-live="polite" className="absolute inset-x-0 bottom-0 flex h-[176px] items-center gap-8 border-t-2 border-hollow-800 bg-black px-9">
          {beat.caption && (
            <>
              <div className="w-56 shrink-0 font-mono text-lg font-bold tracking-[0.15em] text-lamp uppercase">
                {String(chapterIdx + 1).padStart(2, '0')} · {beat.chapter}
              </div>
              <p key={beat.caption} className="stage-fade-in m-0 text-[44px] leading-tight font-semibold text-cream">
                {beat.caption}
              </p>
            </>
          )}
        </section>

        {/* Hidden helpers: the World Simulator (drives the world + level phones) and the vouched warden. */}
        <div aria-hidden className="pointer-events-none absolute top-0 left-0 opacity-0" style={{ width: 1280, height: 800, zIndex: -1 }}>
          {(['sim', 'warden'] as FrameName[]).map((n) => (
            <iframe
              key={n}
              title={n}
              tabIndex={-1}
              src={SRC[n]}
              ref={(el) => {
                frames.current[n] = el
              }}
              style={{ width: 1280, height: 800, border: 0, position: 'absolute', top: 0, left: 0 }}
            />
          ))}
        </div>

        {/* Title / closing cards */}
        {card === 'title' && (
          <div className="absolute inset-0 z-20 flex flex-col justify-center bg-hollow-950 px-40">
            <div className="stage-fade-in border-l-[12px] border-lamp pl-12">
              <div className="font-mono text-2xl tracking-[0.25em] text-hollow-300 uppercase">Patriot HackFest 2026 · Life Underground</div>
              <h1 className="stage-display m-0 mt-6 text-[180px] leading-none font-bold text-lamp">Lantern</h1>
              <div className="stage-display mt-4 text-[88px] leading-none font-medium text-cream">works in the dark</div>
            </div>
          </div>
        )}
        {card === 'closing' && (
          <div className="absolute inset-0 z-20 flex flex-col justify-center gap-10 bg-hollow-950 px-40">
            {['It works without them.', 'It works better with them.', 'They can never turn it off.'].map((line, i) => (
              <p
                key={line}
                className={`stage-fade-in stage-display m-0 text-[96px] leading-none font-bold ${i === 2 ? 'text-lamp' : 'text-cream'}`}
                style={{ animationDelay: `${i * 1.1}s` }}
              >
                {line}
              </p>
            ))}
            <div className="stage-fade-in mt-6 font-mono text-2xl tracking-[0.25em] text-hollow-300 uppercase" style={{ animationDelay: '3.3s' }}>
              Lantern · community-owned · offline-first
            </div>
          </div>
        )}

        {/* The blackout's second of darkness */}
        {black && <div aria-hidden className="absolute inset-0 z-40 bg-black" />}

        {/* Before PLAY: one click starts everything and unlocks sound. */}
        {(phase === 'preparing' || phase === 'ready') && (
          <button
            type="button"
            onClick={phase === 'ready' ? play : undefined}
            disabled={phase === 'preparing'}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/85"
            aria-label={phase === 'ready' ? 'Play the demo with sound' : 'Preparing the demo'}
          >
            <span className={`border-4 px-16 py-8 font-mono text-6xl font-bold tracking-[0.15em] uppercase ${phase === 'ready' ? 'border-lamp text-lamp' : 'border-hollow-700 text-hollow-500'}`}>
              {phase === 'ready' ? '▶ Play' : 'Preparing…'}
            </span>
            <span className="font-mono text-xl tracking-wider text-hollow-300 uppercase">
              {phase === 'ready' ? 'One click starts the demo and turns on sound · Space pause · R restart' : 'Resetting the Hollow and waking the phones'}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
