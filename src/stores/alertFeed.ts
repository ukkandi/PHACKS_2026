// One pipeline for every alert on a resident's phone. Each announcement goes, at once, to:
//   - screen readers (live regions),
//   - a visible caption (for people who can't hear it),
//   - speech, when spoken alerts are on (default: on in blackout mode),
//   - vibration where the device can vibrate, otherwise a visual pulse.
import { create } from 'zustand'
import { getDeviceId } from '../lib/device'
import type { AlertKind, Announcement } from '../lib/spokenPhrases'

export interface AlertItem extends Announcement {
  id: number
  at: number
}

/** Distinct, learnable patterns (ms on/off). */
export const VIBRATION: Record<AlertKind, number[]> = {
  ok: [80],
  message: [60, 80, 60],
  warning: [300, 150, 300],
  danger: [600, 200, 600, 200, 600],
}

const PREF_KEY = () => `lantern-spoken-alerts-${getDeviceId()}`

function loadPref(): boolean | null {
  try {
    const v = localStorage.getItem(PREF_KEY())
    return v === null ? null : v === 'on'
  } catch {
    return null
  }
}

/** Real vibration only on touch devices; desktop browsers expose the API but nothing moves. */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && matchMedia('(pointer: coarse)').matches
}

function speak(text: string, urgent: boolean) {
  // Spoken log: read by scripts/demo-check.cjs (and handy when debugging without speakers).
  const w = window as unknown as { __lanternSpoken?: string[] }
  ;(w.__lanternSpoken ??= []).push(text)
  // Demo stage (/stage): when this phone is embedded in the autopilot page, the stage speaks for it —
  // browsers only allow speech after a click on the page that speaks, and that click is PLAY.
  const stage = window.parent !== window ? (window.parent as unknown as { __lanternStage?: { speak: (t: string, u: boolean) => void } }).__lanternStage : undefined
  if (stage) {
    stage.speak(text, urgent)
    return
  }
  if (!('speechSynthesis' in window)) return
  if (urgent) window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.92 // a little slower: calm and clear
  window.speechSynthesis.speak(u)
}

interface AlertFeedState {
  items: AlertItem[]
  latest: AlertItem | null
  /** Visual pulse currently showing (vibration fallback). */
  pulse: AlertItem | null
  /** User's explicit choice; null = automatic (spoken only in blackout mode). */
  spokenPref: boolean | null
  blackout: boolean
  setBlackout: (b: boolean) => void
  setSpoken: (on: boolean) => void
  spokenOn: () => boolean
  announce: (a: Announcement) => void
}

let seq = 0
let pulseTimer: ReturnType<typeof setTimeout> | null = null

export const useAlertFeed = create<AlertFeedState>((set, get) => ({
  items: [],
  latest: null,
  pulse: null,
  spokenPref: loadPref(),
  blackout: false,
  setBlackout: (b) => set({ blackout: b }),
  setSpoken: (on) => {
    try {
      localStorage.setItem(PREF_KEY(), on ? 'on' : 'off')
    } catch {
      // preference just won't persist
    }
    set({ spokenPref: on })
  },
  spokenOn: () => get().spokenPref ?? get().blackout,
  announce: (a) => {
    const item: AlertItem = { ...a, id: ++seq, at: Date.now() }
    set({ items: [item, ...get().items].slice(0, 20), latest: item })
    if (get().spokenOn()) speak(a.text, a.kind === 'danger')
    if (canVibrate()) navigator.vibrate(VIBRATION[a.kind])
    else {
      if (pulseTimer) clearTimeout(pulseTimer)
      set({ pulse: item })
      pulseTimer = setTimeout(() => set({ pulse: null }), 2600)
    }
  },
}))
