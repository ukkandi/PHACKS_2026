// DEMO-ONLY: who speaks on /stage, and when.
//   - The NARRATOR: pre-recorded public/narration/NN.mp3|m4a|wav when present, otherwise the best available
//     browser voice — a different one from the phones', slower and lower.
//   - The PHONES: alerts the framed resident views ask the stage to say (see alertFeed.speak).
//     They never talk over the narrator: a phone line waits for the narrator's line to end, and a
//     long one is then trimmed to its first sentence. The stage also ducks its drone under him.

/**
 * Line 7, built from the figures on Level 38's board card ("22.0%", "6.4%"), so the narrator says
 * exactly what the screen shows. NARRATION[7] is the seeded demo's values (what the recording says).
 */
export function truthLine(lantern: string, official: string): string {
  const num = (v: string) => v.replace(/\.0%$/, '%').replace('%', '')
  return `Every check-in also counts, anonymously, on a public board. Residents report ${num(lantern)} percent sick on Level 38. The Directorate says ${num(official)}.`
}

/** The script, in play order (public/narration/01–12 are recordings of exactly these). */
export const NARRATION: Record<number, string> = {
  1: '2087. Two billion people live underground in the Hollow. The deeper you live, the sooner the power fails, and the less anyone tells you.',
  2: "This is Mara, on Level 38. She uses Lantern, an app run by residents, not by the Directorate. One tap a day tells her family she's okay.",
  3: "Each phone reads its own level's power meter. Mara's sees the load climbing: a blackout within hours. The Directorate hasn't said a word.",
  4: "The lights go out. So does the Directorate's network.",
  5: "In the dark, Mara doesn't need to read the screen. Lantern speaks the alert, and she answers out loud.",
  6: 'With no network, Lantern passes her message phone to phone, neighbor to neighbor, until it reaches her grandfather Ilan, twenty-six levels up.',
  7: truthLine('22.0%', '6.4%'),
  8: "The levels voted that air comes first. Lantern says spare power belongs to Level 38's air pumps. The Directorate sent it to the top.",
  9: 'Not everyone has a phone. A shared terminal on every level, or a volunteer warden, checks them in.',
  10: 'Every warden is vouched for by three of their neighbors. So when an impostor poses as one to deny the outbreak, every phone spots the fake, and rejects it.',
  11: 'One check-in a day. It stays on your phone. It travels neighbor to neighbor. Only anonymous counts are ever shared.',
  12: 'No accounts to seize. No admin to switch it off. Lantern keeps the Hollow connected, even in the dark.',
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
  /** at: when asked; start/end: when the sound really started and finished (ms from PLAY). */
  __stageNarration?: { line: number; via: 'mp3' | 'voice' | 'skipped'; at: number; text: string; start?: number; end?: number }[]
}

/** Minimum silence between the end of one recorded line and the next. */
const LINE_GAP_MS = 450

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
  private lastEnd = -Infinity
  private voiceStartedAt = 0
  /** >1 in tests: nothing is spoken, lines just pass quickly. */
  speed = 1
  /** Told when the narrator starts and stops (the stage ducks its sound under it). */
  onNarrating: (on: boolean) => void = () => {}
  /** Narrator volume (recorded files): full, so it sits clearly above the drone and the phones. */
  narratorVolume = 1

  /** ms since PLAY. */
  now(): number {
    return Math.round(performance.now() - this.startedAt)
  }

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
    this.lastEnd = -Infinity
    if (!('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    speechSynthesis.speak(u)
  }

  narrating(): boolean {
    return this.audios.size > 0 || this.busy === 'narrator' || this.queue.some((i) => i.kind === 'narrator')
  }

  /**
   * How far into the narrator's current line we are, in ms (for cueing visuals to its sentences).
   * Infinity when no line is playing (so cues never wait on a finished or skipped line).
   */
  lineTime(): number {
    for (const a of this.audios) if (!a.paused || a.currentTime > 0) return a.currentTime * 1000
    if (this.audios.size) return 0 // loading / waiting for its breath
    if (this.busy === 'narrator') return performance.now() - this.voiceStartedAt
    return this.queue.some((q) => q.kind === 'narrator') ? 0 : Infinity
  }

  speaking(): boolean {
    return this.busy !== null || this.queue.length > 0 || this.audios.size > 0
  }

  /**
   * Speak narrator line n. Resolves when it has finished (or would have, in tests). `live`: the line's
   * text built from what's on screen now; if it differs from the scripted line, a recording of the
   * scripted line would say the wrong thing, so the browser voice says the live text instead.
   */
  narrate(n: number, live?: string): Promise<void> {
    const at = this.now()
    const text = live ?? SPOKEN[n] ?? NARRATION[n]
    if (this.speed > 1) {
      ;(this.logs.__stageNarration ??= []).push({ line: n, via: 'skipped', at, text })
      return sleep(300)
    }
    const url = live === undefined || live === NARRATION[n] ? this.mp3.get(n) : undefined
    if (url) {
      const entry: NonNullable<StageLogs['__stageNarration']>[number] = { line: n, via: 'mp3', at, text }
      ;(this.logs.__stageNarration ??= []).push(entry)
      return new Promise((resolve) => {
        const a = new Audio(url)
        a.volume = this.narratorVolume
        this.audios.add(a)
        this.onNarrating(true)
        a.onplaying = () => (entry.start ??= this.now())
        // Let a phone finish its sentence, then a breath, then the line.
        const go = (): void => {
          if (this.busy === 'phone') return void setTimeout(go, 80)
          const wait = Math.max(0, this.lastEnd + LINE_GAP_MS - this.now())
          setTimeout(() => void a.play().catch(end), wait)
        }
        let ended = false
        const end = () => {
          if (ended) return
          ended = true
          entry.end = this.now()
          this.lastEnd = entry.end
          this.audios.delete(a)
          if (!this.narrating()) this.onNarrating(false)
          resolve()
          this.pump()
        }
        a.onended = end
        a.onerror = end
        go()
      })
    }
    const entry: NonNullable<StageLogs['__stageNarration']>[number] = { line: n, via: 'voice', at, text }
    ;(this.logs.__stageNarration ??= []).push(entry)
    this.onNarrating(true)
    return new Promise((resolve) => {
      const done = () => {
        entry.end = this.now()
        resolve()
      }
      // Narrator lines go ahead of any waiting phone lines.
      const i = this.queue.findIndex((q) => q.kind === 'phone')
      const item: Item = { kind: 'narrator', text, volume: 1, done }
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
    const ducked = this.narrating()
    const line = ducked && text.length > 60 ? (text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text) : text
    this.queue.push({ kind: 'phone', text: line, volume: ducked ? 0.6 : 0.8, done: () => {} })
    this.pump()
  }

  /** Hold phone speech (e.g. until after the blackout's second of silence); release plays it. The narrator still speaks. */
  hold(on: boolean, brief = false) {
    this.held = on
    if (!on) {
      const lines = this.heldLines
      this.heldLines = []
      lines.forEach((t) => {
        // already logged when it arrived
        if (this.speed > 1) return
        const ducked = this.narrating()
        const line = (ducked || brief) && t.length > 60 ? (t.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? t) : t
        this.queue.push({ kind: 'phone', text: line, volume: ducked ? 0.6 : 0.8, done: () => {} })
      })
      this.pump()
    }
  }

  private pump() {
    if (!('speechSynthesis' in window)) {
      this.queue.splice(0).forEach((i) => i.done())
      return
    }
    // Nothing talks over a recorded narrator line: queued speech waits for it to end.
    if (this.busy || !this.queue.length || this.audios.size > 0) return
    // While phones are held, only the narrator speaks.
    const i = this.held ? this.queue.findIndex((q) => q.kind === 'narrator') : 0
    if (i < 0) return
    const next = this.queue.splice(i, 1)[0]
    this.busy = next.kind
    this.utter(next, () => {
      this.busy = null
      if (!this.narrating()) this.onNarrating(false)
      this.pump()
    })
  }

  private utter(item: Item, after?: () => void) {
    const u = new SpeechSynthesisUtterance(item.text)
    if (item.kind === 'narrator') this.voiceStartedAt = performance.now()
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
    const log = item.kind === 'phone' ? { text: item.text, start: this.now(), end: 0 } : null
    if (log) ((window as unknown as { __stagePhoneLog?: (typeof log)[] }).__stagePhoneLog ??= []).push(log)
    const finish = () => {
      if (finished) return
      finished = true
      if (log) {
        log.end = this.now()
        this.lastEnd = Math.max(this.lastEnd, log.end)
      }
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
