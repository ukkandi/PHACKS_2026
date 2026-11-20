// DEMO-ONLY autopilot script for /stage — the director's cut. It drives the real app pages in the
// stage's frames exactly as a person would (clicking their buttons), so nothing here changes how
// Lantern works. One focus at a time: the stage's camera shows one panel, the pointer rings one element.
//
// Timing: the narrator paces each beat, but every beat also has a hard deadline (measured from PLAY,
// excluding pauses). The closing card starts no later than CAP.closing and the run always ends by
// CAP.end — under the 3:10 submission limit whatever voice the browser uses (the target is ≤ 3:00).
import { resetDemo } from '../../lib/demoReset'
import type { StageAudio } from './audio'
import { truthLine, type Director } from './director'

export type FrameName = 'mara' | 'ilan' | 'board' | 'sim' | 'warden' | 'terminal'
export type Focus = 'mara' | 'ilan' | 'board' | 'terminal' | 'warden' | 'none'
/** Full-screen cards. 'how' and 'closing' reveal one row per narrated sentence (step = rows shown). */
export type Card =
  | { kind: 'cold' }
  | { kind: 'chapter'; n: number; title: string }
  | { kind: 'how'; step: number }
  | { kind: 'closing'; step: number }
  | null

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
  /**
   * Ring one region (an element, or the union of several): inside a framed page, or on the stage itself
   * ('stage'). zoom > 1: the camera zooms in on it (up to that factor, as far as it fits). null = none.
   */
  point: (frame: FrameName | 'stage' | null, el: Element | (Element | null)[] | null, zoom?: number) => void
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
  cold: 14_000,
  mara: 40_000,
  warning: 72_000,
  dark: 125_000,
  truth: 152_000,
  left: 170_000,
  trust: 180_000,
  how: 182_000,
  closing: 183_000,
  end: 189_000,
}
export const CHAPTER_CARD_MS = 1_500
/** How long THE WARNING's countdown runs on screen (the sim clock is stepped faster to fit). */
export const COUNTDOWN_MS = 8_000
/** Camera zoom on a pointed detail (as far as it fits). */
const ZOOM = 2.3

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

/** Centre an element in its own page. (Not scrollIntoView: that also scrolls the stage around the frame.) */
function show(el: Element | null) {
  const win = el?.ownerDocument.defaultView
  if (!el || !win) return
  const r = el.getBoundingClientRect()
  win.scrollBy({ top: r.top + r.height / 2 - win.innerHeight / 2, behavior: 'smooth' })
}

function click(el: Element | null): boolean {
  if (!el || (el as HTMLButtonElement).disabled) return false
  ;(el as HTMLElement).click()
  return true
}

const ALL: FrameName[] = ['mara', 'ilan', 'board', 'sim', 'warden', 'terminal']

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
      find(d('sim'), 'button', /^Step \+1h$/) &&
      find(d('terminal'), 'button', /^Next$/)
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
    const cards = () => ((window as unknown as { __stageCards?: { card: string; start: number; end?: number }[] }).__stageCards ??= [])
    /** A chapter card is silent: it waits for the narrator to finish (bounded), then holds 1.5 s. */
    const chapter = async (n: number, title: string, maxWait = 6_000) => {
      await until(() => !api.director.narrating(), elapsed() + maxWait * Math.min(1, clock.speed))
      await sleep(300) // a breath before the card
      api.point(null, null)
      api.setBeat('', '')
      api.setCard({ kind: 'chapter', n, title })
      const entry: { card: string; start: number; end?: number } = { card: `${n} · ${title}`, start: api.director.now() }
      cards().push(entry)
      await sleep(CHAPTER_CARD_MS)
      api.setCard(null)
      entry.end = api.director.now()
    }
    const ilanFamily = () => section(d('ilan'), /^Family/)

    const cue = (ms: number, deadline: number) => until(() => api.director.lineTime() >= ms, deadline)
    const nar = (n: number, live?: string) => api.director.narrate(n, live)
    const spokenLog = () => (window as unknown as { __stageSpoken?: string[] }).__stageSpoken ?? []
    const top = (n: FrameName) => d(n)?.defaultView?.scrollTo(0, 0)

    // ── 01 · Cold open (black) ────────────────────────────────────────────────────────────────
    api.camera('none')
    api.setCard({ kind: 'cold' })
    api.audio.startDrone()
    api.check('setup: fresh world, 40/40 levels, warden vouched by 3', prepared || (await prepareWorld(api.frame, () => clock.gen === gen)))
    alive()
    api.setBeat('', '2087. Two billion people, underground.')
    const n1 = nar(1)
    await cue(5_400, CAP.cold)
    api.setBeat('', 'The deeper you live, the sooner power fails.')
    await settle(n1, CAP.cold)

    // ── 02 · Mara's phone: one tap; Ilan sees it ──────────────────────────────────────────────
    api.setCard(null)
    top('mara')
    top('ilan')
    api.camera('mara')
    api.setBeat('', 'This is Mara, on Level 38.')
    const n2 = nar(2)
    const ok = find(d('mara'), 'button', /^I'm okay$/)
    await cue(2_700, CAP.mara - 12_000)
    api.setBeat('', 'Lantern: run by residents, not the Directorate.')
    api.point('mara', ok, ZOOM)
    await cue(7_300, CAP.mara - 10_000)
    api.setBeat('', "One tap a day: I'm okay.")
    await cue(8_600, CAP.mara - 9_000)
    click(ok)
    await raw(250)
    const send = find(d('mara'), 'button', /^Send now/)
    api.point('mara', send, ZOOM)
    await sleep(700)
    click(send)
    const maraOk = await event(() => find(ilanFamily(), 'li', /^Mara · L38\s*●\s*Okay today/i), CAP.mara - 6_000)
    api.check("check-ins: Ilan sees Mara 'okay today'", !!maraOk)
    await settle(n2, CAP.mara - 5_000)
    api.camera('ilan')
    show(maraOk)
    api.setBeat('', 'Twenty-six levels up, Ilan sees it.')
    await sleep(600)
    api.point('ilan', maraOk, ZOOM)
    // Silently: Ilan turns on spoken alerts (so his phone reads Mara's message out later).
    click(find(d('ilan'), 'button', /Spoken alerts: off/))
    await sleep(2_800)

    // ── 1 · THE WARNING · 03: power meter → warning → countdown ───────────────────────────────
    await chapter(1, 'The warning')
    api.director.hold(true) // the phones stay quiet until Mara's phone speaks in the dark
    top('mara')
    api.camera('mara')
    click(find(d('sim'), 'button', /^Power surge$/))
    const n3 = nar(3)
    const powerTile = () => d('mara')?.querySelector('[role="group"][aria-label^="Power:"]') ?? null
    api.setBeat('The warning', "Each phone reads its level's power meter.")
    await sleep(500)
    api.point('mara', powerTile(), ZOOM)
    const hasWarning = () => !!find(d('mara'), '[data-testid="power-warning"]')
    const isDark = () => !!d('mara')?.querySelector('.blackout-mode')
    // The load climbs on the meter while he speaks.
    for (let i = 0; i < 12 && !hasWarning(); i++) {
      await step()
      await sleep(600)
    }
    await cue(2_950, CAP.warning - 20_000)
    api.setBeat('The warning', "Mara's phone sees the load climbing.")
    await cue(4_900, CAP.warning - 18_000)
    const warning = find(d('mara'), '[data-testid="power-warning"]')
    api.point('mara', warning, ZOOM)
    api.setBeat('The warning', 'A blackout within hours.')
    api.check('warning: hours-ahead window + confidence', /Blackout risk · \d+–\d+ hours.*confidence/i.test(textOf(warning)), textOf(warning).slice(0, 70))
    await cue(6_950, CAP.warning - 16_000)
    api.setCountdown(true)
    await raw(100)
    api.point('stage', document.querySelector('[data-stage="countdown"]'))
    api.setBeat('The warning', "The Directorate hasn't said a word.")
    let ilanWarned = false
    // ~8 s on screen: step the sim clock as fast as needed, stop one hour short (the lights go out
    // under the chapter card).
    const cdEnd = elapsed() + COUNTDOWN_MS
    for (let i = 0; i < 24 && !isDark(); i++) {
      const left = api.countdown() ?? 12
      if (left <= 1) break
      await step()
      ilanWarned ||= /L38 blackout/i.test(textOf(ilanFamily()))
      await sleep(Math.max(250, (cdEnd - elapsed()) / Math.max(1, (api.countdown() ?? left) - 1)))
    }
    await settle(n3, CAP.warning)
    api.check('warning reaches Ilan over the mesh', ilanWarned || /L38 blackout/i.test(textOf(ilanFamily())))

    // ── 2 · THE DARK · 04 black + alarm, dark screen ──────────────────────────────────────────
    await chapter(2, 'The dark')
    api.setCountdown(false)
    // SIMULATED: speech recognition. Mara's phone "hears" what she says in the dark through the app's
    // test hook (read when the dark screen's voice control mounts); the rest of the flow is the app's.
    const maraWin = d('mara')?.defaultView as (Window & { __lanternFakeVoice?: { transcript: string } }) | null | undefined
    if (maraWin) maraWin.__lanternFakeVoice = { transcript: 'power out' }
    api.audio.cut()
    api.setBlack(true)
    for (let i = 0; i < 8 && !isDark(); i++) await step()
    const dark = await event(isDark, elapsed(), 6_000)
    api.check('blackout: Mara switches to blackout mode', !!dark)
    await sleep(1_000)
    api.setBlack(false)
    api.audio.alarm()
    top('mara')
    api.camera('mara')
    api.point('mara', find(d('mara'), 'section[role="alert"]'), ZOOM)
    api.setBeat('The dark', 'The lights go out. So does the network.')
    await sleep(900)
    api.audio.afterBlackout()
    const n4 = nar(4)
    await settle(n4, CAP.dark - 40_000)

    // 05 · her phone speaks the alert; she answers out loud.
    const n5 = nar(5)
    api.setBeat('The dark', "In the dark, she needn't read the screen.")
    await cue(3_650, CAP.dark - 36_000)
    api.setBeat('The dark', 'Lantern speaks the alert. She answers aloud.')
    await settle(n5, CAP.dark - 33_000)
    api.director.hold(false, true) // Mara's phone: "The power is out on Level 38."
    api.point('mara', find(d('mara'), '[data-testid="alert-caption"]'), ZOOM)
    await raw(300)
    await quiet(CAP.dark - 29_000)
    api.check(
      'blackout alert spoken (phone)',
      spokenLog().some((t) => t.startsWith('The power is out on Level 38')),
    )
    const holdBtn = find(d('mara'), 'button', /Hold to speak/i)
    show(holdBtn)
    await sleep(500)
    api.point('mara', holdBtn, ZOOM)
    api.setBeat('The dark', 'She answers: “Power out.”')
    await sleep(1_200)
    const key = (type: string) => holdBtn?.dispatchEvent(new ((maraWin as unknown as typeof globalThis | null)?.KeyboardEvent ?? KeyboardEvent)(type, { key: ' ', bubbles: true }))
    key('keydown') // ● Listening…
    await sleep(1_600)
    key('keyup')
    const voice = () => d('mara')?.querySelector('section[aria-label="Voice check-in"]') ?? null
    const heard = await event(() => (/Heard\s*“power out”/i.test(textOf(voice())) ? voice()!.querySelector('[aria-live] > div') : null), CAP.dark - 22_000)
    api.point('mara', heard, ZOOM)
    api.check('voice: HEARD "power out" → ◆ POWER OUT → CONFIRM · SEND', /Heard\s*“power out”\s*→\s*◆\s*Power out\s*Confirm · send/i.test(textOf(heard)), textOf(heard).slice(0, 60))
    await sleep(2_400)
    const confirm = find(heard, 'button', /^Confirm · send$/)
    api.point('mara', confirm, ZOOM)
    await sleep(1_100)
    click(confirm)
    await sleep(500)

    // 06 · the message reaches Ilan (his phone reads it out), phone to phone.
    api.camera('ilan')
    api.point(null, null)
    const msg = await event(() => find(d('ilan'), 'li', /Power is out here\./), CAP.dark - 16_000)
    show(msg)
    await sleep(500)
    api.point('ilan', msg, ZOOM)
    api.setBeat('The dark', 'Ilan hears it: “Power is out here.”')
    await event(() => spokenLog().includes('Message from Mara. Power is out here.'), CAP.dark - 14_000)
    await raw(200)
    await quiet(CAP.dark - 12_000)
    const n6 = nar(6)
    api.setBeat('The dark', 'No network: phone to phone, neighbor to neighbor.')
    await cue(4_600, CAP.dark - 6_000)
    api.setBeat('The dark', 'All the way to Ilan, 26 levels up.')
    await settle(n6, CAP.dark)
    api.check(
      "message reaches Ilan 'passed along by 1 phone' and is read aloud",
      /passed along by 1 phone/i.test(textOf(msg)) && spokenLog().includes('Message from Mara. Power is out here.'),
      textOf(msg).slice(0, 80),
    )

    // ── 3 · THE TRUTH · 07 the L38 card, 08 the allocation ────────────────────────────────────
    // Fever spreads while the chapter card is up, so the board is ready when we cut to it.
    click(find(d('sim'), 'button', /Symptom spike/))
    const spreading = (async () => {
      for (let i = 0; i < 8; i++) await step()
    })()
    await chapter(3, 'The truth')
    await spreading
    // Level 38's card in the outbreak panel: the numbers on screen are the numbers we say.
    const l38Card = () => find(section(board(), /^Outbreak watch$/), 'li', /Level 38 · outbreak/i)
    const figures = (card: Element | null) => {
      const cells = card ? Array.from(card.querySelectorAll(':scope > .grid > div')) : []
      const value = (i: number) => (cells[i]?.children[1] as HTMLElement | undefined) ?? null
      return { tag: card?.querySelector(':scope > div:first-child > *:first-child') ?? null, lantern: value(0), official: value(1) }
    }
    const l38 = await event(() => {
      const f = figures(l38Card())
      return f.lantern && f.official && /^\d+\.\d%$/.test(textOf(f.lantern)) && /^\d+\.\d%$/.test(textOf(f.official)) ? l38Card() : null
    }, CAP.truth - 30_000)
    const fig = figures(l38)
    const lanShown = textOf(fig.lantern)
    const offShown = textOf(fig.official)
    show(l38)
    api.camera('board')
    const spokenTruth = truthLine(lanShown, offShown)
    const n7 = nar(7, spokenTruth)
    await sleep(600)
    api.point('board', [fig.tag, fig.lantern?.parentElement ?? null, fig.official?.parentElement ?? null], ZOOM)
    api.setBeat('The truth', 'Every check-in counts, anonymously, in public.')
    api.check('board: L38 row in DANGER', !!l38 && /Level 38 · outbreak/i.test(textOf(l38)))
    api.check('outbreak: Lantern vs lower official figure', parseFloat(lanShown) > 2 * parseFloat(offShown), `${lanShown || '?'} vs ${offShown || '?'}`)
    await cue(4_450, CAP.truth - 20_000)
    const caption = `Level 38: ${lanShown} sick. Directorate says ${offShown}.`
    api.setBeat('The truth', caption)
    await sleep(300)
    // Same numbers everywhere: caption = what the L38 card shows now = what the narrator says.
    const now = figures(l38Card())
    const capNums = caption.match(/\d+\.\d%/g) ?? []
    const said = (v: string) => v.replace(/\.0%$/, '%').replace('%', '')
    api.check(
      "truth: caption's L38 percentages = the L38 card on screen (and the narration)",
      capNums.length === 2 &&
        capNums[0] === textOf(now.lantern) &&
        capNums[1] === textOf(now.official) &&
        spokenTruth.includes(`report ${said(capNums[0])} percent sick`) &&
        spokenTruth.includes(`says ${said(capNums[1])}.`),
      `caption ${capNums.join(' / ')} · card ${textOf(now.lantern)} / ${textOf(now.official)} · said "${spokenTruth.slice(60)}"`,
    )
    await settle(n7, CAP.truth - 13_000)

    const priorities = findDeepest(board()?.body ?? null, 'div', /Priorities:.*Voted by \d+ of 40 levels/i)
    const rec = find(board(), 'section[aria-labelledby="rec-h"]')
    const dir = find(board(), 'section[aria-labelledby="dir-h"]')
    show(priorities)
    const n8 = nar(8)
    await sleep(500)
    api.point('board', priorities, 2)
    api.setBeat('The truth', 'The levels voted: air comes first.')
    api.check('allocation: priorities voted by 40 of 40 levels', /1 air.*Voted by 40 of 40 levels/i.test(textOf(priorities)), textOf(priorities).slice(0, 80))
    await cue(3_000, CAP.truth - 8_000)
    api.point('board', find(rec, 'li', /Level 38 air pumps/) ?? rec, 2)
    api.setBeat('The truth', "Spare power: Level 38's air pumps.")
    api.check('allocation: Level 38 air pumps first', /Level 38 air pumps/i.test(textOf(rec)))
    await cue(6_950, CAP.truth - 4_000)
    api.point('board', find(dir, 'li', /Levels 1–3 administrative/) ?? dir, 2)
    api.setBeat('The truth', 'The Directorate sent it to the top.')
    api.check('allocation: Directorate → Levels 1–3', /Levels 1–3 administrative/i.test(textOf(dir)))
    await settle(n8, CAP.truth)
    await sleep(800)

    // ── 4 · NO ONE LEFT BEHIND · 09 terminal, then the warden ─────────────────────────────────
    await chapter(4, 'No one left behind')
    const term = () => d('terminal')
    top('terminal')
    api.camera('terminal')
    const n9 = nar(9)
    api.setBeat('No one left behind', 'Not everyone has a phone.')
    await sleep(700)
    api.point('terminal', term()?.querySelector('output') ?? null, 1.6)
    await cue(2_200, CAP.left - 26_000)
    api.setBeat('No one left behind', 'A shared terminal on every level.')
    const tap = async (re: RegExp, hold = 650) => {
      const b = find(term(), 'button', re)
      api.point('terminal', b, 1.6)
      await sleep(hold)
      click(b)
      await sleep(250)
    }
    for (const k of ['2', '0', '7']) await tap(new RegExp(`^${k}$`), 350)
    await tap(/^Next$/)
    await tap(/^I'm okay$/)
    await tap(/^Okay$/)
    await tap(/^7 h \+$/)
    await tap(/^None ▸$/)
    await tap(/^Yes$/)
    const tdone = await event(() => findDeepest(term()?.body ?? null, 'span', /Checked in · okay/i), CAP.left - 14_000)
    api.point('terminal', tdone, ZOOM)
    api.check('terminal: unit 38-207 checked in by unit number', !!tdone && /38-207/.test(textOf(term()?.body ?? null)))
    await settle(n9, CAP.left - 12_000)
    await sleep(1_200)

    top('warden')
    api.camera('warden')
    api.setBeat('No one left behind', 'Or a volunteer warden checks them in.')
    const brandt = () => find(d('warden'), 'li', /Mr\. Brandt/)
    show(brandt())
    await sleep(700)
    const checkIn = find(brandt(), 'button', /^Check in$/)
    api.point('warden', checkIn, ZOOM)
    await sleep(1_400)
    click(checkIn)
    await sleep(400)
    const sendB = find(brandt(), 'button', /^Send$/)
    api.point('warden', sendB, ZOOM)
    await sleep(1_100)
    click(sendB)
    const viaWarden = await event(() => (/via warden/i.test(textOf(brandt())) ? brandt() : null), CAP.left - 2_000)
    api.point('warden', viaWarden, 1.8)
    api.check('warden checks in Mr. Brandt (no phone)', !!viaWarden)
    await sleep(2_200)

    // ── 5 · THE TRUST · 10 vouched warden confirms; an impostor denies, rejected ───────────────
    await chapter(5, 'The trust')
    top('warden')
    const vouched = findDeepest(d('warden')?.body ?? null, 'span', /Active · vouched by 3 of L38/i)
    api.point('warden', vouched, ZOOM)
    const n10 = nar(10)
    api.setBeat('The trust', 'Every warden: vouched for by three neighbors.')
    await sleep(1_300)
    const confirmBtn = await event(() => {
      const b = find<HTMLButtonElement>(d('warden'), 'button', /^Confirm outbreak$/)
      return b && !b.disabled ? b : null
    }, CAP.trust - 20_000)
    click(confirmBtn)
    const badge = await event(
      () => findDeepest(l38Card(), 'span', /✓ confirmed by warden W-38/i),
      CAP.trust - 18_000,
    )
    api.camera('board')
    show(badge)
    await sleep(500)
    api.point('board', badge, ZOOM)
    const badgeAt = elapsed()
    api.check('vouched warden confirmation shown on the board', !!badge)
    await cue(3_400, CAP.trust - 14_000)
    api.setBeat('The trust', 'An impostor poses as one to deny it.')
    // ~4 s on the badge, then the impostor's dispute lands as he says "to deny the outbreak".
    await sleep(Math.max(0, 4_000 - (elapsed() - badgeAt)))
    click(find(d('sim'), 'button', /Impostor warden disputes outbreak on L38/))
    const rejected = await event(
      () => findDeepest(board()?.body ?? null, 'li span', /W-38-WAR disputes outbreak · unverified warden, rejected/i),
      CAP.trust - 10_000,
    )
    show(rejected)
    await sleep(500)
    api.point('board', rejected, ZOOM)
    const rejectedAt = elapsed()
    api.check('impostor dispute rejected (unverified warden)', !!rejected, textOf(rejected))
    await cue(7_050, CAP.trust - 6_000)
    api.setBeat('The trust', 'Every phone spots the fake. Rejected.')
    await settle(n10, CAP.trust - 4_000)
    await sleep(Math.max(1_000, 4_000 - (elapsed() - rejectedAt))) // ≥ ~4 s on the rejection
    api.check('outbreak stays confirmed', /Level 38 · outbreak.*✓ confirmed by warden W-38-WAR/i.test(textOf(l38Card())))

    // ── 11 · how it works ─────────────────────────────────────────────────────────────────────
    api.point(null, null)
    api.setBeat('', '')
    api.camera('none')
    await until(() => !api.director.narrating(), elapsed() + 3_000)
    api.setCard({ kind: 'how', step: 1 })
    const n11 = nar(11)
    for (const [ms, step] of [[2_250, 2], [3_600, 3], [5_450, 4]] as const) {
      await cue(ms, CAP.how)
      api.setCard({ kind: 'how', step })
    }
    await settle(n11, CAP.how)
    await sleep(1_000)

    // ── 12 · closing ──────────────────────────────────────────────────────────────────────────
    if (clock.speed <= 1 && elapsed() > CAP.closing) api.check('closing card on time', false, `${Math.round(elapsed() / 1000)} s`)
    api.setCard({ kind: 'closing', step: 1 })
    const n12 = nar(12)
    await cue(2_100, CAP.end - 6_000)
    api.setCard({ kind: 'closing', step: 2 })
    await cue(4_200, CAP.end - 4_000)
    api.setCard({ kind: 'closing', step: 3 })
    await settle(n12, CAP.end - 2_000)
    api.audio.fadeOut(1_800)
    await sleep(1_800)
  } finally {
    clearInterval(ticker)
  }
}
