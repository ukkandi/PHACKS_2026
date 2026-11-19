// DEMO-ONLY autopilot script for /stage. It drives the real app pages in the stage's frames exactly as
// a person would — clicking their buttons — so nothing here changes how Lantern works.
//
// Timing: the narrator paces each beat, but every beat also has a hard deadline (measured from PLAY,
// excluding pauses). The closing card starts no later than CAP.closing and the run always ends by
// CAP.end — under the 2:00 submission limit whatever voice the browser uses.
import { resetDemo } from '../../lib/demoReset'
import type { StageAudio } from './audio'
import type { Director } from './director'

export type FrameName = 'mara' | 'ilan' | 'board' | 'sim' | 'warden'

export class Aborted extends Error {}

/** Shared, mutable clock: paused / speed / generation (bumped on restart to abort a run). */
export interface Clock {
  speed: number
  paused: boolean
  gen: number
}

export interface StageApi {
  frame: (name: FrameName) => HTMLIFrameElement | null
  setBeat: (chapter: string, caption: string, focus: FrameName[]) => void
  setCard: (card: 'title' | 'closing' | null) => void
  /** Full-screen black (the blackout's second of darkness). */
  setBlack: (on: boolean) => void
  /** Show/hide the "L38 · BLACKOUT IN ~9H" countdown (its value comes from the live world). */
  setCountdown: (on: boolean) => void
  /** Hours currently shown on the countdown, or null. */
  countdown: () => number | null
  director: Director
  audio: StageAudio
  check: (name: string, ok: boolean, detail?: string) => void
}

/** Deadlines in ms from PLAY (show time). */
export const CAP = {
  title: 3_000,
  checkins: 21_000,
  warning: 38_000,
  blackout: 50_000,
  message: 62_000,
  outbreak: 76_000,
  allocation: 87_000,
  warden: 101_000,
  closing: 107_000,
  end: 114_000,
}
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

/** A <section> whose own heading matches. */
function section(doc: Document | null, heading: RegExp): HTMLElement | null {
  if (!doc) return null
  for (const h of Array.from(doc.querySelectorAll('section h2, section h3'))) {
    if (heading.test(norm(h.textContent))) return h.closest('section')
  }
  return null
}

const textOf = (el: Element | null) => norm(el?.textContent)

function highlight(doc: Document | null, els: (Element | null)[], scroll = true) {
  if (!doc) return
  if (!doc.getElementById('stage-hl-style')) {
    const st = doc.createElement('style')
    st.id = 'stage-hl-style'
    st.textContent = '.stage-hl{outline:3px solid #F2A33A !important;outline-offset:3px !important;}'
    doc.head.appendChild(st)
  }
  doc.querySelectorAll('.stage-hl').forEach((e) => e.classList.remove('stage-hl'))
  const real = els.filter((e): e is Element => !!e)
  real.forEach((e) => e.classList.add('stage-hl'))
  if (scroll && real[0]) real[0].scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function clearHighlights(doc: Document | null) {
  doc?.querySelectorAll('.stage-hl').forEach((e) => e.classList.remove('stage-hl'))
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
    /** Dwell (show time, frozen while paused). */
    const sleep = async (ms: number) => {
      const until = elapsed() + ms
      while (elapsed() < until) {
        alive()
        await raw(40)
      }
    }
    /** Wait for something, but never past an absolute deadline (show time). */
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
    /**
     * Wait for something the APP does (a message crossing the mesh, a signature check): bounded by the
     * beat's deadline, but always allowing a few real seconds — app events don't speed up in tests.
     */
    const event = <T>(pred: () => T | null | undefined | false, deadline: number, realMs = 4_000) =>
      until(pred, Math.max(deadline, elapsed() + realMs * clock.speed))
    /** Resolve when a promise settles or the deadline passes. */
    const settle = async (p: Promise<unknown>, deadline: number) => {
      let done = false
      void p.then(() => (done = true))
      await until(() => done, deadline)
    }
    const quiet = (deadline: number) => until(() => !api.director.speaking(), deadline)
    const gap = (ms: number) => Math.max(150, ms / clock.speed)
    const d = (n: FrameName) => docOf(api.frame(n))
    const board = () => d('board')
    const sim = {
      click: (re: RegExp) => click(find(d('sim'), 'button', re)),
      step: async () => {
        alive()
        click(find(d('sim'), 'button', /^Step \+1h$/))
        await raw(gap(0))
        while (clock.paused) await raw(100)
      },
    }

    // 0 · Title (3 s). Narration 1 starts and carries on over the first beat.
    api.setCard('title')
    api.setBeat('', '', [])
    api.audio.startDrone()
    if (!prepared) {
      api.check('setup: fresh world, 40/40 levels, warden vouched by 3', await prepareWorld(api.frame, () => clock.gen === gen))
    } else api.check('setup: fresh world, 40/40 levels, warden vouched by 3', true)
    alive()
    const n1 = api.director.narrate(1)
    await sleep(CAP.title)
    api.setCard(null)

    // 1 · Check-ins (short)
    api.setBeat('Check-in', 'Two phones, 26 levels apart: Mara on Level 38, Ilan on Level 12.', ['mara', 'ilan'])
    d('mara')?.defaultView?.scrollTo(0, 0)
    d('ilan')?.defaultView?.scrollTo(0, 0)
    await settle(n1, CAP.checkins - 9_000)
    const n2 = api.director.narrate(2)
    api.setBeat('Check-in', 'Each of them checks in with one tap.', ['mara', 'ilan'])
    for (const who of ['mara', 'ilan'] as FrameName[]) {
      const ok = find(d(who), 'button', /^I'm okay$/)
      highlight(d(who), [ok], false)
      await sleep(900)
      click(ok)
      await raw(250)
      click(find(d(who), 'button', /^Send now/))
      await raw(250)
      highlight(d(who), [find(d(who), 'section[aria-label="Today\'s check-in"]')], false)
    }
    const checked = await event(() => /Mara · L38\s*●\s*Okay today/i.test(textOf(section(d('ilan'), /^Family/))), CAP.checkins)
    api.check("check-ins: Ilan sees Mara 'okay today'", !!checked)
    // Silently: Ilan turns on spoken alerts (so his phone can read Mara's message out later).
    click(find(d('ilan'), 'button', /Spoken alerts: off/))
    await settle(n2, CAP.checkins)
    clearHighlights(d('mara'))
    clearHighlights(d('ilan'))

    // 2 · Warning + countdown (the drone rises with it)
    api.setBeat('Warning', "Level 38's power load starts to climb.", ['mara'])
    d('mara')?.defaultView?.scrollTo({ top: 0, behavior: 'smooth' })
    const n3 = api.director.narrate(3)
    let n3done = false
    void n3.then(() => (n3done = true))
    api.director.hold(true) // keep the phones quiet until after the blackout's silence
    sim.click(/^Power surge$/)
    const hasWarning = () => !!find(d('mara'), '[data-testid="power-warning"]')
    const isDark = () => !!d('mara')?.querySelector('.blackout-mode')
    for (let i = 0; i < 12 && !hasWarning(); i++) await sim.step().then(() => sleep(650))
    const warning = find(d('mara'), '[data-testid="power-warning"]')
    highlight(d('mara'), [warning])
    api.check('warning: hours-ahead window + confidence', /Blackout risk · \d+–\d+ hours.*confidence/i.test(textOf(warning)), textOf(warning).slice(0, 70))
    api.setCountdown(true)
    api.setBeat('Warning', "Mara's phone sees a blackout coming hours ahead — nobody announced it.", ['mara'])
    let ilanWarned = false
    for (let i = 0; i < 24 && !isDark(); i++) {
      // Don't let the lights go out mid-sentence: near the end, wait for the narrator.
      if ((api.countdown() ?? 99) <= 2 && !n3done) await until(() => n3done, CAP.warning)
      await sim.step()
      await sleep(700)
      ilanWarned ||= /L38 blackout/i.test(textOf(section(d('ilan'), /^Family/)))
    }
    api.check('warning reaches Ilan over the mesh', ilanWarned)

    // 3 · Blackout: one second of black and silence, an alarm, then the narrator.
    // The story needs the blackout itself, so this wait isn't capped by the timeline (it's seconds).
    const dark = await until(isDark, elapsed() + 8_000)
    api.check('blackout: Mara switches to blackout mode', !!dark)
    api.setCountdown(false)
    api.audio.cut()
    api.setBlack(true)
    await sleep(1_000)
    api.setBlack(false)
    api.audio.alarm()
    api.setBeat('Blackout', 'The feeder trips. Level 38 goes dark.', ['mara'])
    d('mara')?.defaultView?.scrollTo(0, 0)
    highlight(d('mara'), [find(d('mara'), 'section[role="alert"]')], false)
    await sleep(900)
    api.audio.afterBlackout()
    const n4 = api.director.narrate(4)
    api.director.hold(false) // Mara's own spoken alert follows, ducked
    await settle(n4, CAP.blackout - 3_000)
    api.setBeat('Blackout', "Mara's phone dims, flashes and speaks the alert.", ['mara'])
    await quiet(CAP.blackout)
    api.check('blackout alert spoken (phone)', (window as unknown as { __stageSpoken?: string[] }).__stageSpoken?.some((t) => t.startsWith('The power is out on Level 38')) ?? false)

    // 4 · Mara's message, phone to phone
    api.setBeat('Message', 'With no network on her level, Mara taps POWER OUT.', ['mara'])
    const n5 = api.director.narrate(5)
    const powerOut = find(d('mara'), 'button', /^Power out$/)
    highlight(d('mara'), [powerOut])
    await sleep(1_400)
    click(powerOut)
    const msg = await event(() => find(d('ilan'), 'li', /Power is out here\./), CAP.message - 4_000)
    api.setBeat('Message', "Neighbors' phones pass it up to Ilan, and his phone reads it out.", ['ilan'])
    highlight(d('ilan'), [msg])
    await settle(n5, CAP.message)
    await quiet(CAP.message)
    const spoken = (window as unknown as { __stageSpoken?: string[] }).__stageSpoken ?? []
    api.check(
      "message reaches Ilan 'passed along by 1 phone' and is read aloud",
      /passed along by 1 phone/i.test(textOf(msg)) && spoken.includes('Message from Mara. Power is out here.'),
      textOf(msg).slice(0, 80),
    )
    clearHighlights(d('mara'))

    // 5 · Outbreak vs the official number
    api.setBeat('Outbreak', 'Fever spreads through the deep levels.', ['board'])
    clearHighlights(d('ilan'))
    const n6 = api.director.narrate(6)
    sim.click(/Symptom spike/)
    for (let i = 0; i < 8; i++) {
      await sim.step()
      await raw(gap(250))
    }
    const rows = [34, 35, 36, 37, 38, 39, 40].map((n) => find(board(), 'tr', new RegExp(`^L${n}\\b`)))
    highlight(board(), rows)
    api.check('board: L34–L40 in DANGER', rows.every((r) => /danger/i.test(textOf(r))))
    await sleep(2_500)
    const l38 = await event(() => find(section(board(), /^Outbreak watch$/), 'li', /Level 38 · outbreak/i), CAP.outbreak - 3_000)
    const m = textOf(l38).match(/Lantern\s*([\d.]+)%.*?Official\s*([\d.]+)%/i)
    const lan = m ? Math.round(Number(m[1])) : NaN
    const off = m ? Number(m[2]).toFixed(1) : '?'
    api.setBeat('Outbreak', `Residents report ${lan}% sick on Level 38 — the Directorate says ${off}%.`, ['board'])
    highlight(board(), [l38])
    api.check('outbreak: Lantern vs lower official figure', !!m && Number(m[1]) > 2 * Number(m[2]), m ? `${m[1]}% vs ${m[2]}%` : '')
    await settle(n6, CAP.outbreak)
    await sleep(1_500)

    // 6 · Allocation (brief)
    api.setBeat('Allocation', "Lantern says power Level 38's air first — the Directorate sent most to its own districts.", ['board'])
    const n7 = api.director.narrate(7)
    const rec = find(board(), 'section[aria-labelledby="rec-h"]')
    const dir = find(board(), 'section[aria-labelledby="dir-h"]')
    highlight(board(), [rec])
    api.check('allocation: Level 38 air pumps first', /Level 38 air pumps/i.test(textOf(rec)))
    api.check('allocation: Directorate → Levels 1–3', /Levels 1–3 administrative/i.test(textOf(dir)))
    await sleep(3_500)
    highlight(board(), [rec, dir])
    await settle(n7, CAP.allocation)

    // 7 · Vouched warden confirms; an impostor is rejected
    api.setBeat('Warden', 'A warden vouched for by three neighbors confirms the outbreak.', ['board'])
    const n8 = api.director.narrate(8)
    const confirmBtn = await event(() => {
      const b = find<HTMLButtonElement>(d('warden'), 'button', /^Confirm outbreak$/)
      return b && !b.disabled ? b : null
    }, CAP.warden - 8_000)
    click(confirmBtn)
    const confirmed = await event(() => find(board(), 'li', /Level 38 · outbreak.*confirmed by warden W-38/i), CAP.warden - 6_000)
    highlight(board(), [confirmed])
    api.check('vouched warden confirmation shown on the board', !!confirmed)
    await sleep(3_500)
    api.setBeat('Warden', 'An impostor claims to be that warden — the public board rejects it.', ['board'])
    sim.click(/Impostor warden confirms outbreak on L38/)
    const rejected = await event(() => find(board(), 'li', /W-38-WAR confirms outbreak · unverified warden, rejected/i), CAP.warden - 2_000)
    highlight(board(), [rejected])
    api.check('impostor rejected (unverified warden)', !!rejected)
    await settle(n8, CAP.warden)
    await sleep(800)

    // 8 · Closing (5 s card); narration 9 starts just before it (no lead-in if we're running late).
    const n9 = api.director.narrate(9)
    if (elapsed() < CAP.closing - 1_000) await sleep(1_000)
    if (elapsed() > CAP.closing) api.check('closing card on time', false, `${Math.round(elapsed() / 1000)} s`)
    api.setBeat('', '', [])
    api.setCard('closing')
    api.audio.fadeOut(CLOSING_CARD_MS)
    await sleep(CLOSING_CARD_MS)
    await settle(n9, CAP.end)
  } finally {
    clearInterval(ticker)
  }
}
