// DEMO-ONLY: who speaks on /stage, and when.
//   - The NARRATOR: pre-recorded public/narration/NN.mp3|m4a|wav when present, otherwise the best available
//     browser voice — a different one from the phones', slower and lower.
//   - The PHONES: alerts the framed resident views ask the stage to say (see alertFeed.speak),
//     ducked under the narrator. With mp3 narration they truly play quietly underneath. Browser
//     voices can't overlap, so then a phone line waits for the narrator, plays quieter, and a long
//     one is trimmed to its first sentence.

export const NARRATION: Record<number, string> = {
  1: 'Level 38. Two kilometers underground. Down here, the lights go out first.',
  2: "This is Mara. Every morning she taps one button, so her grandfather, twenty-six levels up, knows she's okay.",
  3: "Today, Lantern sees something the Directorate hasn't announced. Level 38's power is failing.",
  4: 'The lights go out. The network goes with them.',
  5: "But Mara's message still finds its way. Phone to phone, neighbor to neighbor, all the way to Ilan.",
  6: 'And every check-in adds up. Twenty-two percent of Level 38 is sick. The Directorate says six.',
  7: "The spare power belongs to Level 38's air pumps. The Directorate sent it to the top. Now everyone can see.",
  8: 'A warden her neighbors vouched for confirms it. An impostor tries. Rejected.',
  9: 'No accounts. No admin. No off switch. Lantern works in the dark.',
}

/** Optional spoken overrides (none needed for the current lines). */
const SPOKEN: Record<number, string> = {}

/** Recorded narration: public/narration/NN.<ext>, first match wins. Browsers play all three. */
const EXTENSIONS = ['mp3', 'm4a', 'wav']

type Kind = 'narrator' | 'phone'
interface Item {
  kind: Kind
  text: string
  volume: number
  done: () => void
}

interface StageLogs {
  __stageSpoken?: string[]
  __stageNarration?: { line: number; via: 'mp3' | 'voice' | 'skipped'; at: number }[]
}

const words = (t: string) => t.split(/\s+/).filter(Boolean).length
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class Director {
  /** Lines with a recorded file. */
  private mp3 = new Map<number, string>()
  private narratorVoice: SpeechSynthesisVoice | null = null
  private phoneVoice: SpeechSynthesisVoice | null = null
  private queue: Item[] = []
  private busy: Kind | null = null
  private held = false
  private heldLines: string[] = []
  private audios = new Set<HTMLAudioElement>()
  private startedAt = 0
  /** >1 in tests: nothing is spoken, lines just pass quickly. */
  speed = 1

  private get logs(): StageLogs {
    return window as unknown as StageLogs
  }

  /** Find recorded narration files and the voices to use. Safe to call more than once. */
  async prepare() {
    this.pickVoices()
    if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => this.pickVoices()
    await Promise.all(
      Object.keys(NARRATION).map(async (k) => {
        for (const ext of EXTENSIONS) {
          const url = `/narration/${k.padStart(2, '0')}.${ext}`
          try {
            const r = await fetch(url, { method: 'HEAD' })
            // A missing file falls back to the app page (HTML), so check it's really audio.
            if (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio')) {
              this.mp3.set(Number(k), url)
              return
            }
          } catch {
            // no file: try the next format, then the browser voice
          }
        }
      }),
    )
  }

  get recordedLines(): number {
    return this.mp3.size
  }

  get voiceNames(): { narrator: string; phone: string } {
    return { narrator: this.narratorVoice?.name ?? 'default', phone: this.phoneVoice?.name ?? 'default' }
  }

  private pickVoices() {
    if (!('speechSynthesis' in window)) return
    const voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang))
    if (!voices.length) return
    const score = (v: SpeechSynthesisVoice, low: boolean) =>
      (/Natural|Neural|Premium|Enhanced|Online/i.test(v.name) ? 4 : 0) +
      (low && /Daniel|Arthur|Oliver|Guy|Davis|Andrew|Christopher|Brian|Aaron|Alex|Fred|UK English Male|Ryan/i.test(v.name) ? 3 : 0) +
      (!low && /Samantha|Google US English|Aria|Jenny|Zira|Ava|Allison/i.test(v.name) ? 3 : 0) +
      (/en[-_](US|GB)/i.test(v.lang) ? 1 : 0) +
      (v.localService ? 0.5 : 0)
    const byScore = (low: boolean) => [...voices].sort((a, b) => score(b, low) - score(a, low))
    this.phoneVoice = byScore(false)[0] ?? null
    this.narratorVoice = byScore(true).find((v) => v.name !== this.phoneVoice?.name) ?? byScore(true)[0] ?? null
  }

  /** Called inside the PLAY click: unlock speech for this page. */
  unlock() {
    this.startedAt = performance.now()
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    speechSynthesis.speak(u)
  }

  private narrating(): boolean {
    return this.audios.size > 0 || this.busy === 'narrator' || this.queue.some((i) => i.kind === 'narrator')
  }

  speaking(): boolean {
    return this.busy !== null || this.queue.length > 0 || this.audios.size > 0
  }

  /** Speak narrator line n. Resolves when it has finished (or would have, in tests). */
  narrate(n: number): Promise<void> {
    const at = Math.round(performance.now() - this.startedAt)
    if (this.speed > 1) {
      ;(this.logs.__stageNarration ??= []).push({ line: n, via: 'skipped', at })
      return sleep(300)
    }
    const url = this.mp3.get(n)
    if (url) {
      ;(this.logs.__stageNarration ??= []).push({ line: n, via: 'mp3', at })
      return new Promise((resolve) => {
        const a = new Audio(url)
        this.audios.add(a)
        const end = () => {
          this.audios.delete(a)
          resolve()
          this.pump()
        }
        a.onended = end
        a.onerror = end
        void a.play().catch(end)
      })
    }
    ;(this.logs.__stageNarration ??= []).push({ line: n, via: 'voice', at })
    return new Promise((done) => {
      // Narrator lines go ahead of any waiting phone lines.
      const i = this.queue.findIndex((q) => q.kind === 'phone')
      const item: Item = { kind: 'narrator', text: SPOKEN[n] ?? NARRATION[n], volume: 1, done }
      if (i < 0) this.queue.push(item)
      else this.queue.splice(i, 0, item)
      this.pump()
    })
  }

  /** A framed phone asks to say something (always logged, so captions/tests can follow it). */
  phone(text: string) {
    ;(this.logs.__stageSpoken ??= []).push(text)
    if (this.speed > 1) return
    if (this.held) {
      this.heldLines.push(text)
      return
    }
    if (this.audios.size > 0) {
      // Recorded narrator playing: the phone speaks right away, ducked underneath it.
      this.utter({ kind: 'phone', text, volume: 0.35, done: () => {} })
      return
    }
    const ducked = this.narrating()
    const line = ducked && text.length > 60 ? (text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text) : text
    this.queue.push({ kind: 'phone', text: line, volume: ducked ? 0.45 : 0.8, done: () => {} })
    this.pump()
  }

  /** Hold phone speech (e.g. during the blackout's second of silence); release plays it. */
  hold(on: boolean) {
    this.held = on
    if (!on) {
      const lines = this.heldLines
      this.heldLines = []
      lines.forEach((t) => {
        // already logged when it arrived
        if (this.speed > 1) return
        const ducked = this.narrating()
        const line = ducked && t.length > 60 ? (t.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? t) : t
        this.queue.push({ kind: 'phone', text: line, volume: ducked ? 0.45 : 0.8, done: () => {} })
      })
      this.pump()
    }
  }

  private pump() {
    if (this.busy || this.held || !this.queue.length || !('speechSynthesis' in window)) {
      if (!('speechSynthesis' in window)) this.queue.splice(0).forEach((i) => i.done())
      return
    }
    const next = this.queue.shift()!
    this.busy = next.kind
    this.utter(next, () => {
      this.busy = null
      this.pump()
    })
  }

  private utter(item: Item, after?: () => void) {
    const u = new SpeechSynthesisUtterance(item.text)
    u.lang = 'en-US'
    if (item.kind === 'narrator') {
      if (this.narratorVoice) u.voice = this.narratorVoice
      u.rate = 0.86
      u.pitch = 0.75
    } else {
      if (this.phoneVoice) u.voice = this.phoneVoice
      u.rate = 1
      u.pitch = 1.1
    }
    u.volume = item.volume
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      item.done()
      after?.()
    }
    u.onend = finish
    u.onerror = finish
    // Some browsers never fire 'end': fall back to a generous estimate of the line's length.
    setTimeout(finish, ((words(item.text) / 2.3) * (1 / u.rate) + 2.5) * 1000)
    speechSynthesis.speak(u)
  }

  pause() {
    if ('speechSynthesis' in window) speechSynthesis.pause()
    this.audios.forEach((a) => a.pause())
  }

  resume() {
    if ('speechSynthesis' in window) speechSynthesis.resume()
    this.audios.forEach((a) => void a.play())
  }

  stop() {
    this.queue.splice(0).forEach((i) => i.done())
    this.heldLines = []
    this.held = false
    this.busy = null
    this.audios.forEach((a) => a.pause())
    this.audios.clear()
    if ('speechSynthesis' in window) speechSynthesis.cancel()
  }
}
