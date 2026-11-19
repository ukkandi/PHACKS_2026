// DEMO-ONLY: /stage — a hands-free, 16:9 autopilot of the whole demo for screen recording.
// Real app pages run in same-origin frames (so the phone-to-phone mesh works as with tabs); the
// script in ./show.ts clicks their buttons. One click on PLAY also unlocks the stage's voice.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Aborted, runShow, type Clock, type FrameName, type StageApi } from './show'
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

const CHAPTERS = ['Two phones', 'Check-in', 'Warning', 'Blackout', 'Message', 'Outbreak', 'Allocation', 'Warden', 'Impostor', 'Trust']

type Phase = 'idle' | 'playing' | 'paused' | 'done'

interface StageWindow extends Window {
  __lanternStage?: { speak: (text: string, urgent: boolean) => void }
  __stageLog?: { name: string; ok: boolean; detail?: string }[]
  __stageSpoken?: string[]
  __stageDone?: boolean
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
  const clock = useRef<Clock>({ speed: Math.max(0.25, Number(new URLSearchParams(location.search).get('speed')) || 1), paused: false, gen: 0 })
  const [phase, setPhase] = useState<Phase>('idle')
  const [beat, setBeat] = useState<{ chapter: string; caption: string; focus: FrameName[] }>({ chapter: '', caption: '', focus: [] })
  const [card, setCard] = useState<'title' | 'closing' | null>(null)
  const w = window as StageWindow

  useEffect(() => {
    document.title = 'Lantern — works in the dark (stage)'
    w.__stageSpoken = []
    // The stage speaks for the framed phones (see alertFeed.speak).
    w.__lanternStage = {
      speak: (text, urgent) => {
        w.__stageSpoken!.push(text)
        if (!('speechSynthesis' in window)) return
        if (urgent) speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'en-US'
        u.rate = 0.92
        const voice =
          speechSynthesis.getVoices().find((v) => /en[-_]US/i.test(v.lang) && /Google|Samantha|Natural/i.test(v.name)) ??
          speechSynthesis.getVoices().find((v) => /^en/i.test(v.lang))
        if (voice) u.voice = voice
        speechSynthesis.speak(u)
      },
    }
    return () => {
      delete w.__lanternStage
    }
  }, [w])

  const play = useCallback(() => {
    // The click itself unlocks audio: speak a silent utterance inside the gesture.
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      speechSynthesis.speak(u)
    }
    clock.current.gen++
    clock.current.paused = false
    w.__stageLog = []
    w.__stageSpoken = []
    w.__stageDone = false
    setPhase('playing')
    const api: StageApi = {
      frame: (n) => frames.current[n] ?? null,
      setBeat: (chapter, caption, focus) => setBeat({ chapter, caption, focus }),
      setCard,
      speaking: () => 'speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending),
      spoken: () => w.__stageSpoken ?? [],
      check: (name, ok, detail) => w.__stageLog!.push({ name, ok, detail }),
    }
    runShow(api, clock.current)
      .then(() => {
        w.__stageDone = true
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
    if ('speechSynthesis' in window) {
      if (c.paused) speechSynthesis.pause()
      else speechSynthesis.resume()
    }
    setPhase(c.paused ? 'paused' : 'playing')
  }, [])

  const restart = useCallback(() => {
    if ('speechSynthesis' in window) speechSynthesis.cancel()
    setCard(null)
    play()
  }, [play])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        if (phase === 'idle' || phase === 'done') play()
        else togglePause()
      } else if (e.key === 'r' || e.key === 'R') restart()
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
            <button type="button" onClick={phase === 'idle' ? play : restart} className="border-2 border-hollow-500 px-3 py-1 font-mono text-sm font-bold uppercase">
              {phase === 'idle' ? '▶ Play' : '↺ Restart'}
            </button>
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
                style={{ animationDelay: `${i * 1.6}s` }}
              >
                {line}
              </p>
            ))}
            <div className="stage-fade-in mt-6 font-mono text-2xl tracking-[0.25em] text-hollow-300 uppercase" style={{ animationDelay: '5s' }}>
              Lantern · community-owned · offline-first
            </div>
          </div>
        )}

        {/* Before PLAY: one click starts everything and unlocks sound. */}
        {phase === 'idle' && (
          <button
            type="button"
            onClick={play}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black/80"
            aria-label="Play the demo with sound"
          >
            <span className="border-4 border-lamp px-16 py-8 font-mono text-6xl font-bold tracking-[0.15em] text-lamp uppercase">▶ Play</span>
            <span className="font-mono text-xl tracking-wider text-hollow-300 uppercase">One click starts the demo and turns on sound · Space pause · R restart</span>
          </button>
        )}
      </div>
    </div>
  )
}
