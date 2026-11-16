// Voice check-in. Works in the dark: say a few words instead of finding a button.
// Recognition uses the browser's Web Speech API where it exists; everywhere else the buttons remain.

export type VoiceIntent = 'okay' | 'help' | 'power-out' | 'need-water'

export const INTENT_LABEL: Record<VoiceIntent, string> = {
  okay: "I'm okay",
  help: 'I need help',
  'power-out': 'Power out',
  'need-water': 'Need water',
}

/** Phrases we accept for each intent (checked in this order: help beats okay in "I'm not okay"). */
const PATTERNS: [VoiceIntent, RegExp][] = [
  ['help', /\b(need(s)? help|help me|^help\b|help$|not (ok|okay|fine|alright|all right)|emergency|hurt|sos)\b/],
  ['power-out', /\b(power(\s*is|'s)?\s*(out|off|down|gone)|no power|lights? (are |is )?(out|off)|black ?out)\b/],
  ['need-water', /\b(need(s)? water|no water|water)\b/],
  ['okay', /\b(i('?m| am) (ok|okay|fine|alright|all right|safe)|^(ok|okay|fine|safe|all good)$|i('?m| am) good|all good)\b/],
]

/** Map what was heard to one of four actions, or null if it isn't clear. Pure. */
export function parseUtterance(transcript: string): VoiceIntent | null {
  const t = transcript
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return null
  for (const [intent, re] of PATTERNS) if (re.test(t)) return intent
  return null
}

export interface Recognizer {
  start: () => void
  stop: () => void
  abort: () => void
}

export interface RecognizerHandlers {
  onResult: (transcript: string) => void
  onError: (reason: 'no-speech' | 'not-allowed' | 'unavailable' | 'other') => void
  onEnd: () => void
}

/**
 * TEST HOOK (used only by scripts/demo-check.cjs): a test can define
 * `window.__lanternFakeVoice = { transcript: "I need help" }` BEFORE the page loads; the app then
 * uses a fake recognizer that "hears" that transcript when the button is released.
 */
interface FakeVoice {
  transcript: string
}

// Minimal typing for the (still prefixed in Chrome/Safari) Web Speech API.
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function getFake(): FakeVoice | null {
  return (window as unknown as { __lanternFakeVoice?: FakeVoice }).__lanternFakeVoice ?? null
}

/** Is voice input possible in this browser? */
export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && (getFake() !== null || getCtor() !== null)
}

export function createRecognizer(h: RecognizerHandlers): Recognizer | null {
  const fake = getFake()
  if (fake) {
    let listening = false
    return {
      start: () => {
        listening = true
      },
      stop: () => {
        if (!listening) return
        listening = false
        setTimeout(() => {
          h.onResult(fake.transcript)
          h.onEnd()
        }, 50)
      },
      abort: () => {
        listening = false
        h.onEnd()
      },
    }
  }
  const Ctor = getCtor()
  if (!Ctor) return null
  const r = new Ctor()
  r.lang = 'en-US'
  r.interimResults = false
  r.maxAlternatives = 1
  r.continuous = false
  let heard = ''
  r.onresult = (e) => {
    heard = Array.from(e.results)
      .map((res) => res[0]?.transcript ?? '')
      .join(' ')
      .trim()
  }
  r.onerror = (e) => h.onError(e.error === 'no-speech' ? 'no-speech' : e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'not-allowed' : e.error === 'network' ? 'unavailable' : 'other')
  r.onend = () => {
    if (heard) h.onResult(heard)
    h.onEnd()
  }
  return {
    start: () => {
      heard = ''
      try {
        r.start()
      } catch {
        h.onError('other')
      }
    },
    stop: () => r.stop(),
    abort: () => r.abort(),
  }
}
