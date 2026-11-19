// DEMO-ONLY: /stage — the director's cut. A hands-free, 16:9 autopilot of the demo (≤ 1:55) with one
// focus at a time: the camera shows one panel, an amber ring points at the one element that matters.
// Real app pages run in same-origin frames (so the phone-to-phone mesh works as with tabs); the
// script in ./show.ts clicks their buttons. One click on PLAY unlocks sound.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useWorld } from '../../lib/worldFeed'
import { predictBlackout } from '../../sim/predict'
import { StageAudio } from './audio'
import { Director } from './director'
import { Aborted, prepareWorld, runShow, type Card, type Clock, type Focus, type FrameName, type StageApi } from './show'
import './stage.css'

const W = 1920
const H = 1080
const CAPTION_H = 176
const PHONE = { w: 390, h: 744, scale: 1 }
const BOARD = { w: 1000, h: 560, scale: 1.38 }
const PANEL_PAD = 24 // border + padding around the frame
const PHONE_OUT_W = PHONE.w * PHONE.scale + PANEL_PAD
const BOARD_OUT_W = BOARD.w * BOARD.scale + PANEL_PAD

const SRC: Record<FrameName, string> = {
  mara: '/resident?device=mara&as=mara',
  ilan: '/resident?device=ilan&as=ilan',
  board: '/ledger?device=board',
  sim: '/sim',
  warden: '/warden?level=38&device=warden38',
}

const RING_GLIDE = 'left 600ms cubic-bezier(.4,0,.2,1), top 600ms cubic-bezier(.4,0,.2,1), width 600ms, height 600ms, opacity 300ms'
const CHAPTERS = ['The warning', 'The dark', 'The truth', 'The trust']

type Phase = 'preparing' | 'ready' | 'playing' | 'paused' | 'done'
type Pose = { x: number; y: number; s: number; o: number }

/** Where each panel sits for each camera focus: one prominent, the rest dimmed or away. */
function pose(panel: 'mara' | 'ilan' | 'board', focus: Focus): Pose {
  const center = { x: (W - PHONE_OUT_W) / 2, y: 70, s: 1, o: 1 }
  if (panel === 'board') return focus === 'board' ? { x: (W - BOARD_OUT_W) / 2, y: 66, s: 1, o: 1 } : { x: (W - BOARD_OUT_W) / 2, y: 180, s: 0.92, o: 0 }
  if (focus === panel) return center
  const dimLeft = { x: 140, y: 170, s: 0.8, o: 0.15 }
  const dimRight = { x: W - 140 - PHONE_OUT_W * 0.8, y: 170, s: 0.8, o: 0.15 }
  if (focus === 'mara' || focus === 'ilan') return panel === 'mara' ? dimLeft : dimRight
  return panel === 'mara' ? { x: -PHONE_OUT_W - 80, y: 70, s: 0.9, o: 0 } : { x: W + 80, y: 70, s: 0.9, o: 0 }
}

const poseStyle = (p: Pose): CSSProperties => ({
  transform: `translate(${p.x}px, ${p.y}px) scale(${p.s})`,
  opacity: p.o,
  transition: 'transform 600ms cubic-bezier(.4,0,.2,1), opacity 600ms ease',
  transformOrigin: 'top left',
})

interface StageWindow extends Window {
  __lanternStage?: { speak: (text: string, urgent: boolean) => void }
  __stageLog?: { name: string; ok: boolean; detail?: string }[]
  __stageSpoken?: string[]
  __stageNarration?: unknown[]
  __stageDone?: boolean
  __stageRunMs?: number
  __stageVoices?: { narrator: string; phone: string; recordedLines: number }
  __stageFocus?: Focus
  __stagePointer?: string
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
  const stageRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const frames = useRef<Partial<Record<FrameName, HTMLIFrameElement | null>>>({})
  const pointer = useRef<{ frame: FrameName | 'stage' | null; el: Element | null; at: number }>({ frame: null, el: null, at: 0 })
  const speed = Math.max(0.25, Number(new URLSearchParams(location.search).get('speed')) || 1)
  const clock = useRef<Clock>({ speed, paused: false, gen: 0 })
  const audio = useRef(new StageAudio())
  const director = useRef(new Director())
  const [phase, setPhase] = useState<Phase>('preparing')
  const [beat, setBeat] = useState<{ chapter: string; caption: string }>({ chapter: '', caption: '' })
  const [card, setCard] = useState<Card>(null)
  const [focus, setFocus] = useState<Focus>('none')
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

  // The pointer ring follows its element every frame (through scrolling and camera moves).
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const ring = ringRef.current
      const stage = stageRef.current
      if (!ring || !stage) return
      const { frame, el } = pointer.current
      if (!frame || !el || !el.isConnected) {
        ring.style.opacity = '0'
        return
      }
      const r = el.getBoundingClientRect()
      let x = r.left
      let y = r.top
      let k = 1
      if (frame !== 'stage') {
        const iframe = frames.current[frame]
        if (!iframe) return
        const vh = iframe.contentWindow?.innerHeight ?? iframe.offsetHeight
        if (r.bottom < 0 || r.top > vh) {
          ring.style.opacity = '0' // scrolled out of view
          return
        }
        const f = iframe.getBoundingClientRect()
        k = f.width / iframe.offsetWidth
        x = f.left + r.left * k
        y = f.top + r.top * k
      }
      const s = stage.getBoundingClientRect()
      const sk = s.width / W
      const pad = 8
      ring.style.left = `${(x - s.left) / sk - pad}px`
      ring.style.top = `${(y - s.top) / sk - pad}px`
      ring.style.width = `${(r.width * k) / sk + pad * 2}px`
      ring.style.height = `${(r.height * k) / sk + pad * 2}px`
      ring.style.opacity = '1'
      // Glide to a new target (600 ms), then follow it exactly (through scrolling and camera moves).
      const moving = performance.now() - pointer.current.at < 650
      ring.style.transition = moving ? RING_GLIDE : 'opacity 300ms'
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Countdown: hours until Level 38's feeder fails, from the live world; it only ever ticks down.
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
      setBeat: (chapter, caption) => setBeat({ chapter, caption }),
      setCard,
      camera: (f) => {
        w.__stageFocus = f
        setFocus(f)
      },
      point: (frame, el) => {
        pointer.current = { frame, el, at: performance.now() }
        w.__stagePointer = el ? `${frame}:${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)}` : ''
      },
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
    pointer.current = { frame: null, el: null, at: 0 }
    setCard(null)
    setBlack(false)
    setCountdownOn(false)
    setFocus('none')
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

  const panel = (n: 'mara' | 'ilan' | 'board', size: { w: number; h: number; scale: number }, label: string) => (
    <figure className="absolute top-0 left-0 m-0" style={poseStyle(pose(n, focus))} aria-hidden={focus !== n}>
      <figcaption className="mb-2 font-mono text-lg font-bold tracking-[0.15em] text-lamp uppercase">{label}</figcaption>
      <div className="border-4 border-hollow-700 bg-black p-2">
        <div style={{ width: size.w * size.scale, height: size.h * size.scale }} className="overflow-hidden">
          <iframe
            title={label}
            src={SRC[n]}
            tabIndex={focus === n ? 0 : -1}
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
        ref={stageRef}
        className="absolute overflow-hidden bg-hollow-950"
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left', left: (window.innerWidth - W * scale) / 2, top: (window.innerHeight - H * scale) / 2 }}
      >
        {/* Top bar: chapter rail + controls */}
        <header className="absolute inset-x-0 top-0 z-30 flex h-12 items-center justify-between px-9">
          <div className="font-mono text-sm font-bold tracking-[0.2em] text-hollow-500 uppercase">Lantern</div>
          <ol className="flex gap-1" aria-label="Chapters">
            {CHAPTERS.map((c, i) => (
              <li
                key={c}
                className={`px-2 py-0.5 font-mono text-xs tracking-wider uppercase ${
                  i === chapterIdx ? 'bg-lamp font-bold text-hollow-950' : i < chapterIdx ? 'text-hollow-500' : 'text-hollow-700'
                }`}
              >
                {i + 1} · {c}
              </li>
            ))}
          </ol>
          <div className={`flex gap-2 transition-opacity ${phase === 'playing' ? 'opacity-0 hover:opacity-100' : ''}`}>
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

        {/* The three panels; the camera moves them (one prominent at a time). */}
        {panel('board', BOARD, 'Public board · all levels')}
        {panel('mara', PHONE, 'Mara · Level 38')}
        {panel('ilan', PHONE, 'Ilan · Level 12')}

        {/* Countdown to the blackout, ticking with the simulated clock (beside Mara's phone). */}
        <div
          data-stage="countdown"
          role="status"
          className="absolute z-20 border-4 border-danger bg-black"
          style={{ left: 70, top: 380, opacity: countdownOn && countdown !== null ? 1 : 0, transition: 'opacity 600ms ease' }}
        >
          <div className="hazard h-2" aria-hidden />
          <div className="px-6 py-3 font-mono font-bold tracking-[0.1em] text-danger uppercase">
            <div className="text-2xl">▲ L38 · Blackout in</div>
            <div className="text-[84px] leading-none">~{countdown ?? '–'}h</div>
          </div>
        </div>

        {/* The pointer: an amber ring (with ▼) on the one element that matters. */}
        <div
          ref={ringRef}
          aria-hidden
          className="pointer-events-none absolute z-30 border-4 border-lamp"
          style={{ opacity: 0, transition: RING_GLIDE }}
        >
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 font-mono text-4xl leading-none text-lamp">▼</div>
        </div>

        {/* Caption (≤ 8 words) */}
        <section
          aria-live="polite"
          className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-8 bg-black px-12"
          style={{ height: CAPTION_H }}
        >
          {beat.caption && (
            <>
              {beat.chapter && (
                <div className="w-64 shrink-0 font-mono text-lg font-bold tracking-[0.15em] text-lamp uppercase">
                  {chapterIdx + 1} · {beat.chapter}
                </div>
              )}
              <p key={beat.caption} className="stage-fade-in m-0 text-[52px] leading-tight font-semibold text-cream">
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

        {/* Cards */}
        {card?.kind === 'cold' && <div className="absolute inset-x-0 top-0 z-40 bg-black" style={{ bottom: CAPTION_H }} />}
        {card?.kind === 'chapter' && (
          <div className="absolute inset-0 z-40 flex items-center bg-hollow-950 px-40">
            <div className="stage-fade-in flex items-baseline gap-10">
              <span className="stage-display text-[220px] leading-none font-bold text-lamp">{card.n}</span>
              <span className="stage-display text-[120px] leading-none font-bold tracking-tight text-cream uppercase">{card.title}</span>
            </div>
          </div>
        )}
        {card?.kind === 'closing' && (
          <div className="absolute inset-0 z-40 flex flex-col justify-center gap-10 bg-hollow-950 px-40">
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
        {black && <div aria-hidden className="absolute inset-0 z-50 bg-black" />}

        {/* Before PLAY: one click starts everything and unlocks sound. */}
        {(phase === 'preparing' || phase === 'ready') && (
          <button
            type="button"
            onClick={phase === 'ready' ? play : undefined}
            disabled={phase === 'preparing'}
            className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-black"
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
