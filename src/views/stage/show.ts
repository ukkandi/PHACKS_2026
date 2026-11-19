// DEMO-ONLY autopilot script for /stage — the director's cut. It drives the real app pages in the
// stage's frames exactly as a person would (clicking their buttons), so nothing here changes how
// Lantern works. One focus at a time: the stage's camera shows one panel, the pointer rings one element.
//
// Timing: the narrator paces each beat, but every beat also has a hard deadline (measured from PLAY,
// excluding pauses). The closing card starts no later than CAP.closing and the run always ends by
// CAP.end — under the 2:00 submission limit whatever voice the browser uses.
import { resetDemo } from '../../lib/demoReset'
import type { StageAudio } from './audio'
import type { Director } from './director'

export type FrameName = 'mara' | 'ilan' | 'board' | 'sim' | 'warden'
export type Focus = 'mara' | 'ilan' | 'board' | 'none'
export type Card = { kind: 'cold' } | { kind: 'chapter'; n: number; title: string } | { kind: 'closing' } | null

export class Aborted extends Error {}

/** Shared, mutable clock: paused / speed / generation (bumped on restart to abort a run). */
export interface Clock {
  speed: number
  paused: boolean
  gen: number
}

export interface StageApi {
  frame: (name: FrameName) => HTMLIFrameElement | null
  /** Caption (≤ 8 words) and the chapter it belongs to ('' = none). */
  setBeat: (chapter: string, caption: string) => void
  setCard: (card: Card) => void
  /** Which panel the camera shows. */
  camera: (focus: Focus) => void
  /** Ring one element: inside a framed page, or on the stage itself ('stage'). null = no ring. */
  point: (frame: FrameName | 'stage' | null, el: Element | null) => void
  /** Full-screen black (the blackout's second of darkness). */
  setBlack: (on: boolean) => void
  /** Show/hide the "L38 · BLACKOUT IN ~Nh" countdown (its value comes from the live world). */
  setCountdown: (on: boolean) => void
  countdown: () => number | null
  director: Director
  audio: StageAudio
  check: (name: string, ok: boolean, detail?: string) => void
}

/** Deadlines in ms from PLAY (show time). */
export const CAP = {
  cold: 9_000,
  mara: 27_000,
  warning: 45_000,
  dark: 68_000,
  truth: 92_000,
  trust: 105_000,
  closing: 108_000,
  end: 114_000,
}
export const CHAPTER_CARD_MS = 1_500
export const CLOSING_CARD_MS = 5_000

const raw = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── DOM helpers for the framed pages (same origin) ─────────────────────────────────────────────
function docOf(f: HTMLIFrameElement | null): Document | null {
  try {
    return f?.contentDocument ?? null
  } catch {
    return null
  }
}

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

function find<T extends Element = HTMLElement>(root: Document | Element | null, selector: string, re?: RegExp): T | null {
  if (!root) return null
  for (const el of Array.from(root.querySelectorAll<T>(selector))) {
    if (!re || re.test(norm(el.textContent)) || re.test(el.getAttribute('aria-label') ?? '')) return el
  }
  return null
}

/** The innermost element matching (so a ring hugs the badge itself, not its wrapper). */
function findDeepest(root: Document | Element | null, selector: string, re: RegExp): HTMLElement | null {
  if (!root) return null
  const all = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => re.test(norm(el.textContent)))
  return all.find((el) => !all.some((o) => o !== el && el.contains(o))) ?? null
}

/** A <section> whose own heading matches. */
function section(doc: Document | null, heading: RegExp): HTMLElement | null {
  if (!doc) return null
  for (const h of Array.from(doc.querySelectorAll('section h2, section h3'))) {
    if (heading.test(norm(h.textContent))) return h.closest('section')
  }
  return null
}

const textOf = (el: Element | null) => norm(el?.textContent)

function show(el: Element | null, block: ScrollLogicalPosition = 'center') {
  el?.scrollIntoView({ block, behavior: 'smooth' })
}

function click(el: Element | null): boolean {
  if (!el || (el as HTMLButtonElement).disabled) return false
  ;(el as HTMLElement).click()
  return true
}

const ALL: FrameName[] = ['mara', 'ilan', 'board', 'sim', 'warden']

/**
 * Reset every framed page and wait until the demo's starting state is ready: fresh world,
 * 40/40 levels on the board, the warden vouched by 3, both phones set up.
 */
export async function prepareWorld(frame: StageApi['frame'], isAlive: () => boolean = () => true): Promise<boolean> {
  const d = (n: FrameName) => docOf(frame(n))
  const win = (n: FrameName) => frame(n)?.contentWindow as (Window & { __stageStale?: boolean }) | null
  for (const n of ALL) {
    const w = win(n)
    if (w) w.__stageStale = true
  }
  await resetDemo({ reloadSelf: false })
  for (let t = 0; t < 30_000 && isAlive(); t += 150) {
    const fresh = ALL.every((n) => win(n) && !win(n)!.__stageStale)
    if (
      fresh &&
      find(d('mara'), 'button', /^I'm okay$/) &&
      find(d('ilan'), 'button', /^I'm okay$/) &&
      /40 \/ 40 levels/i.test(textOf(d('board')?.body ?? null)) &&
      /Active · vouched by 3 of L38/i.test(textOf(d('warden')?.body ?? null)) &&
      find(d('sim'), 'button', /^Step \+1h$/)
    )
      return true
    await raw(150)
  }
  return false
}

// ── The show ───────────────────────────────────────────────────────────────────────────────────
export async function runShow(api: StageApi, clock: Clock, prepared: boolean) {
  const gen = clock.gen
  const alive = () => {
    if (clock.gen !== gen) throw new Aborted()
  }
  // Show time: advances only while playing, scaled by ?speed=.
  let showMs = 0
  let last = performance.now()
  const tickShow = () => {
    const now = performance.now()
    if (!clock.paused) showMs += (now - last) * clock.speed
    last = now
  }
  const ticker = setInterval(tickShow, 50)
  const elapsed = () => {
    tickShow()
    return showMs
  }
  try {
    const sleep = async (ms: number) => {
      const until = elapsed() + ms
      while (elapsed() < until) {
        alive()
        await raw(40)
      }
    }
    const until = async <T>(pred: () => T | null | undefined | false, deadline: number): Promise<T | null> => {
      for (;;) {
        alive()
        let v: T | null | undefined | false = null
        try {
          v = pred()
        } catch {
          v = null
        }
        if (v) return v
        if (elapsed() >= deadline) return null
        await raw(80)
      }
    }
    /** Wait for something the APP does: bounded by the deadline, but always allowing a few real seconds. */
    const event = <T>(pred: () => T | null | undefined | false, deadline: number, realMs = 4_000) =>
      until(pred, Math.max(deadline, elapsed() + realMs * clock.speed))
    const settle = async (p: Promise<unknown>, deadline: number) => {
      let done = false
      void p.then(() => (done = true))
      await until(() => done, deadline)
    }
    const quiet = (deadline: number) => until(() => !api.director.speaking(), deadline)
    const d = (n: FrameName) => docOf(api.frame(n))
    const board = () => d('board')
    const step = async () => {
      alive()
      click(find(d('sim'), 'button', /^Step \+1h$/))
      await raw(Math.max(150, 150 / clock.speed))
      while (clock.paused) await raw(100)
    }
    const chapter = async (n: number, title: string) => {
      api.point(null, null)
      api.setBeat('', '')
      api.setCard({ kind: 'chapter', n, title })
      await sleep(CHAPTER_CARD_MS)
      api.setCard(null)
    }
    const ilanFamily = () => section(d('ilan'), /^Family/)

    // ── Cold open: black, line 1 ──────────────────────────────────────────────────────────────
    api.camera('none')
    api.setCard({ kind: 'cold' })
    api.audio.startDrone()
    api.check('setup: fresh world, 40/40 levels, warden vouched by 3', prepared || (await prepareWorld(api.frame, () => clock.gen === gen)))
    alive()
    api.setBeat('', 'Level 38. Two kilometers underground.')
    const n1 = api.director.narrate(1)
    await sleep(3_000)
    await settle(n1, CAP.cold)

    // ── Mara alone: one tap ───────────────────────────────────────────────────────────────────
    api.setCard(null)
    d('mara')?.defaultView?.scrollTo(0, 0)
    d('ilan')?.defaultView?.scrollTo(0, 0)
    api.camera('mara')
    api.setBeat('', "This is Mara. One tap: I'm okay.")
    const n2 = api.director.narrate(2)
    await sleep(900)
    const ok = find(d('mara'), 'button', /^I'm okay$/)
    api.point('mara', ok)
    await sleep(2_600)
    click(ok)
    await raw(250)
    const send = find(d('mara'), 'button', /^Send now/)
    api.point('mara', send)
    await sleep(900)
    click(send)
    await raw(300)
    api.point('mara', find(d('mara'), 'section[aria-label="Today\'s check-in"]'))
    const maraOk = await event(() => find(ilanFamily(), 'li', /^Mara · L38\s*●\s*Okay today/i), CAP.mara - 5_000)
    api.check("check-ins: Ilan sees Mara 'okay today'", !!maraOk)
    await settle(n2, CAP.mara - 4_000)

    // Ilan, briefly: "Mara · okay".
    api.camera('ilan')
    show(maraOk)
    api.setBeat('', 'Twenty-six levels up, Ilan sees it.')
    await sleep(700)
    api.point('ilan', maraOk)
    // Silently: Ilan turns on spoken alerts (so his phone can read Mara's message out later).
    click(find(d('ilan'), 'button', /Spoken alerts: off/))
    await sleep(2_300)

    // ── 1 · THE WARNING ───────────────────────────────────────────────────────────────────────
    api.camera('mara')
    d('mara')?.defaultView?.scrollTo(0, 0)
    await chapter(1, 'The warning')
    api.director.hold(true) // phones stay quiet until after the blackout's silence
    const n3 = api.director.narrate(3)
    let n3done = false
    void n3.then(() => (n3done = true))
    click(find(d('sim'), 'button', /^Power surge$/))
    api.setBeat('The warning', 'Lantern sees the blackout coming.')
    const hasWarning = () => !!find(d('mara'), '[data-testid="power-warning"]')
    const isDark = () => !!d('mara')?.querySelector('.blackout-mode')
    for (let i = 0; i < 12 && !hasWarning(); i++) {
      await step()
      await sleep(650)
    }
    const warning = find(d('mara'), '[data-testid="power-warning"]')
    api.point('mara', warning)
    api.check('warning: hours-ahead window + confidence', /Blackout risk · \d+–\d+ hours.*confidence/i.test(textOf(warning)), textOf(warning).slice(0, 70))
    await sleep(1_600)
    api.setCountdown(true)
    await raw(100)
    api.point('stage', document.querySelector('[data-stage="countdown"]'))
    api.setBeat('The warning', 'Nobody announced it. Hours of warning.')
    let ilanWarned = false
    // Step toward the failure, but stop one hour short: the lights go out under the chapter card.
    for (let i = 0; i < 24 && !isDark(); i++) {
      if ((api.countdown() ?? 99) <= 1) break
      if ((api.countdown() ?? 99) <= 3 && !n3done) await until(() => n3done, CAP.warning)
      await step()
      await sleep(750)
      ilanWarned ||= /L38 blackout/i.test(textOf(ilanFamily()))
    }
    await settle(n3, CAP.warning)
    api.check('warning reaches Ilan over the mesh', ilanWarned || /L38 blackout/i.test(textOf(ilanFamily())))

    // ── 2 · THE DARK ──────────────────────────────────────────────────────────────────────────
    await chapter(2, 'The dark')
    api.setCountdown(false)
    api.audio.cut()
    api.setBlack(true)
    // The feeder trips in the dark (never capped: the story needs the blackout itself).
    for (let i = 0; i < 8 && !isDark(); i++) await step()
    const dark = await event(isDark, elapsed(), 6_000)
    api.check('blackout: Mara switches to blackout mode', !!dark)
    await sleep(1_000)
    api.setBlack(false)
    api.audio.alarm()
    api.camera('mara')
    d('mara')?.defaultView?.scrollTo(0, 0)
    api.point('mara', find(d('mara'), 'section[role="alert"]'))
    api.setBeat('The dark', 'The lights go out. The network too.')
    await sleep(900)
    api.audio.afterBlackout()
    const n4 = api.director.narrate(4)
    api.director.hold(false) // Mara's own spoken alert follows, ducked
    await settle(n4, CAP.dark - 16_000)
    api.check(
      'blackout alert spoken (phone)',
      (window as unknown as { __stageSpoken?: string[] }).__stageSpoken?.some((t) => t.startsWith('The power is out on Level 38')) ?? false,
    )
    const powerOut = find(d('mara'), 'button', /^Power out$/)
    show(powerOut)
    await sleep(500)
    api.point('mara', powerOut)
    api.setBeat('The dark', 'Mara sends: power out.')
    await quiet(CAP.dark - 13_000)
    await sleep(800)
    click(powerOut)
    await sleep(700)

    // Cut to Ilan receiving it.
    const n5 = api.director.narrate(5)
    api.camera('ilan')
    api.point(null, null)
    const msg = await event(() => find(d('ilan'), 'li', /Power is out here\./), CAP.dark - 9_000)
    show(msg)
    await sleep(500)
    api.point('ilan', msg)
    api.setBeat('The dark', 'Phone to phone, it reaches Ilan.')
    await settle(n5, CAP.dark)
    await quiet(CAP.dark)
    const spoken = (window as unknown as { __stageSpoken?: string[] }).__stageSpoken ?? []
    api.check(
      "message reaches Ilan 'passed along by 1 phone' and is read aloud",
      /passed along by 1 phone/i.test(textOf(msg)) && spoken.includes('Message from Mara. Power is out here.'),
      textOf(msg).slice(0, 80),
    )

    // ── 3 · THE TRUTH ─────────────────────────────────────────────────────────────────────────
    // Fever spreads while the chapter card is up, so the board is ready when we cut to it.
    click(find(d('sim'), 'button', /Symptom spike/))
    const spreading = (async () => {
      for (let i = 0; i < 8; i++) await step()
    })()
    await chapter(3, 'The truth')
    await spreading
    const l38 = await event(() => {
      const r = find(board(), 'tr', /^L38\b/)
      return r && /danger/i.test(textOf(r)) && /\d+\.\d%.*\d+\.\d%/.test(textOf(r)) ? r : null
    }, CAP.truth - 20_000)
    show(l38)
    api.camera('board')
    const m = textOf(l38).match(/(\d+\.\d)%\D*?(\d+\.\d)%/)
    const lan = m ? Math.round(Number(m[1])) : NaN
    const off = m ? Number(m[2]).toFixed(1) : '?'
    const n6 = api.director.narrate(6)
    await sleep(700)
    api.point('board', l38)
    api.setBeat('The truth', `${lan}% sick. The Directorate says ${off}%.`)
    api.check('board: L38 row in DANGER', /danger/i.test(textOf(l38)))
    api.check('outbreak: Lantern vs lower official figure', !!m && Number(m[1]) > 2 * Number(m[2]), m ? `${m[1]}% vs ${m[2]}%` : textOf(l38).slice(0, 60))
    await settle(n6, CAP.truth - 11_000)

    const rec = find(board(), 'section[aria-labelledby="rec-h"]')
    const dir = find(board(), 'section[aria-labelledby="dir-h"]')
    const grid = rec?.parentElement ?? rec
    show(grid)
    const n7 = api.director.narrate(7)
    await sleep(700)
    api.point('board', find(rec, 'li', /Level 38 air pumps/) ?? rec)
    api.setBeat('The truth', "Air for Level 38. Power went upstairs.")
    api.check('allocation: Level 38 air pumps first', /Level 38 air pumps/i.test(textOf(rec)))
    api.check('allocation: Directorate → Levels 1–3', /Levels 1–3 administrative/i.test(textOf(dir)))
    await sleep(4_000)
    api.point('board', find(dir, 'li', /Levels 1–3 administrative/) ?? dir)
    await settle(n7, CAP.truth)

    // ── 4 · THE TRUST ─────────────────────────────────────────────────────────────────────────
    const confirmBtn = await event(() => {
      const b = find<HTMLButtonElement>(d('warden'), 'button', /^Confirm outbreak$/)
      return b && !b.disabled ? b : null
    }, CAP.trust - 12_000)
    click(confirmBtn)
    await chapter(4, 'The trust')
    const badge = await event(
      () => findDeepest(find(section(board(), /^Outbreak watch$/), 'li', /Level 38 · outbreak/i), 'span', /✓ confirmed by warden W-38/i),
      CAP.trust - 9_000,
    )
    show(badge)
    const n8 = api.director.narrate(8)
    await sleep(700)
    api.point('board', badge)
    api.setBeat('The trust', 'Vouched by neighbors, the warden confirms.')
    api.check('vouched warden confirmation shown on the board', !!badge)
    await sleep(3_200)
    click(find(d('sim'), 'button', /Impostor warden confirms outbreak on L38/))
    const rejected = await event(() => find(board(), 'li', /W-38-WAR confirms outbreak · unverified warden, rejected/i), CAP.trust - 3_000)
    show(rejected)
    await sleep(600)
    api.point('board', rejected)
    api.setBeat('The trust', 'An impostor tries. Rejected.')
    api.check('impostor rejected (unverified warden)', !!rejected)
    await settle(n8, CAP.trust)
    await sleep(900)

    // ── Closing (5 s card), line 9 ────────────────────────────────────────────────────────────
    const n9 = api.director.narrate(9)
    if (clock.speed <= 1 && elapsed() > CAP.closing) api.check('closing card on time', false, `${Math.round(elapsed() / 1000)} s`)
    api.point(null, null)
    api.setBeat('', '')
    api.camera('none')
    api.setCard({ kind: 'closing' })
    api.audio.fadeOut(CLOSING_CARD_MS)
    await sleep(CLOSING_CARD_MS)
    await settle(n9, CAP.end)
  } finally {
    clearInterval(ticker)
  }
}
