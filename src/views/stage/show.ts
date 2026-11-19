// DEMO-ONLY autopilot script for /stage. It drives the real app pages in the stage's frames exactly as
// a person would — clicking their buttons — so nothing here changes how Lantern works.
import { resetDemo } from '../../lib/demoReset'

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
  /** True while the stage is still speaking (or has speech queued). */
  speaking: () => boolean
  spoken: () => string[]
  check: (name: string, ok: boolean, detail?: string) => void
}

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

/** Set a React-controlled <select> the way a user would. */
function choose(sel: HTMLSelectElement | null, value: string) {
  if (!sel) return
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(sel), 'value')?.set
  setter?.call(sel, value)
  sel.dispatchEvent(new Event('change', { bubbles: true }))
}

// ── The show ───────────────────────────────────────────────────────────────────────────────────
export async function runShow(api: StageApi, clock: Clock) {
  const gen = clock.gen
  const alive = () => {
    if (clock.gen !== gen) throw new Aborted()
  }
  /** Dwell time (scaled by ?speed=, frozen while paused). */
  const sleep = async (ms: number) => {
    let left = ms / clock.speed
    while (left > 0) {
      alive()
      await raw(50)
      if (!clock.paused) left -= 50
    }
  }
  /** Wait (real time, frozen while paused) for something to become true; null on timeout. */
  const waitFor = async <T>(pred: () => T | null | undefined | false, timeoutMs: number): Promise<T | null> => {
    let t = 0
    for (;;) {
      alive()
      let v: T | null | undefined | false = null
      try {
        v = pred()
      } catch {
        v = null
      }
      if (v) return v
      if (t > timeoutMs) return null
      await raw(100)
      if (!clock.paused) t += 100
    }
  }
  const gap = (ms: number) => Math.max(150, ms / clock.speed)
  const d = (n: FrameName) => docOf(api.frame(n))
  const win = (n: FrameName) => api.frame(n)?.contentWindow as (Window & { __stageStale?: boolean }) | null
  const speechIdle = async (maxMs: number) => {
    await raw(400)
    await waitFor(() => !api.speaking(), maxMs)
  }

  const sim = {
    click: (re: RegExp) => click(find(d('sim'), 'button', re)),
    step: async (n: number, ms: number) => {
      for (let i = 0; i < n; i++) {
        alive()
        click(find(d('sim'), 'button', /^Step \+1h$/))
        await raw(gap(ms))
      }
    },
    stepUntil: async (done: () => boolean, max: number, ms: number) => {
      for (let i = 0; i < max && !done(); i++) {
        alive()
        click(find(d('sim'), 'button', /^Step \+1h$/))
        await raw(gap(ms))
        while (clock.paused) await raw(100)
      }
      return done()
    },
  }

  // 0 · Title card, while everything resets behind it.
  api.setCard('title')
  api.setBeat('', '', [])
  for (const n of ['mara', 'ilan', 'board', 'sim', 'warden'] as FrameName[]) {
    const w = win(n)
    if (w) w.__stageStale = true
  }
  const ready = (async () => {
    await resetDemo({ reloadSelf: false })
    return waitFor(() => {
      const fresh = (['mara', 'ilan', 'board', 'sim', 'warden'] as FrameName[]).every((n) => win(n) && !win(n)!.__stageStale)
      return (
        fresh &&
        find(d('mara'), 'button', /^I'm okay$/) &&
        find(d('ilan'), 'button', /^I'm okay$/) &&
        /40 \/ 40 levels/i.test(textOf(d('board')?.body ?? null)) &&
        /Active · vouched by 3 of L38/i.test(textOf(d('warden')?.body ?? null)) &&
        find(d('sim'), 'button', /^Step \+1h$/)
      )
    }, 25_000)
  })()
  await sleep(4000)
  api.check('setup: fresh world, 40/40 levels, warden vouched by 3', !!(await ready))
  api.setCard(null)

  // 1 · Two phones
  api.setBeat('Two phones', 'Two phones, 26 levels apart: Mara on Level 38, Ilan on Level 12.', ['mara', 'ilan'])
  d('mara')?.defaultView?.scrollTo(0, 0)
  d('ilan')?.defaultView?.scrollTo(0, 0)
  await sleep(6000)

  api.setBeat('Two phones', 'Ilan turns on spoken alerts.', ['ilan'])
  const toggle = find(d('ilan'), 'button', /Spoken alerts: off/)
  highlight(d('ilan'), [toggle])
  await sleep(1800)
  click(toggle)
  await sleep(2500)

  api.setBeat('Check-in', 'Each of them checks in with one tap.', ['mara', 'ilan'])
  for (const who of ['mara', 'ilan'] as FrameName[]) {
    d(who)?.defaultView?.scrollTo({ top: 0, behavior: 'smooth' })
    const ok = find(d(who), 'button', /^I'm okay$/)
    highlight(d(who), [ok], false)
    await sleep(1400)
    click(ok)
    await raw(300)
    click(find(d(who), 'button', /^Send now/))
    await raw(300)
    highlight(d(who), [find(d(who), 'section[aria-label="Today\'s check-in"]')], false)
  }
  const checked = await waitFor(() => /Mara · L38\s*●\s*Okay today/i.test(textOf(section(d('ilan'), /^Family/))), 10_000)
  api.check("check-ins: Ilan sees Mara 'okay today'", !!checked)
  highlight(d('ilan'), [section(d('ilan'), /^Family/)])
  await sleep(6000)

  // 2 · Warning, hours ahead
  api.setBeat('Warning', "Level 38's power load starts to climb.", ['mara'])
  clearHighlights(d('ilan'))
  d('mara')?.defaultView?.scrollTo({ top: 0, behavior: 'smooth' })
  sim.click(/^Power surge$/)
  const warned = await sim.stepUntil(() => !!find(d('mara'), '[data-testid="power-warning"]'), 12, 900)
  const warning = find(d('mara'), '[data-testid="power-warning"]')
  highlight(d('mara'), [warning])
  api.check('warning: hours-ahead window + confidence', warned && /Blackout risk · \d+–\d+ hours.*confidence/i.test(textOf(warning)), textOf(warning).slice(0, 80))
  api.setBeat('Warning', "Mara's phone sees a blackout coming hours ahead — nobody announced it.", ['mara'])
  await sleep(8000)

  api.setBeat('Warning', "Ilan, far above, gets the warning through neighbors' phones.", ['ilan'])
  const ilanHeard = await waitFor(() => /L38 blackout/i.test(textOf(section(d('ilan'), /^Family/))) && section(d('ilan'), /^Family/), 6000)
  highlight(d('ilan'), [ilanHeard || null])
  api.check('warning reaches Ilan over the mesh', !!ilanHeard)
  await sleep(7000)

  // 3 · Blackout
  api.setBeat('Blackout', 'The feeder trips. Level 38 goes dark.', ['mara'])
  clearHighlights(d('ilan'))
  clearHighlights(d('mara'))
  const dark = await sim.stepUntil(() => !!d('mara')?.querySelector('.blackout-mode'), 20, 500)
  api.check('blackout: Mara switches to blackout mode', dark)
  api.setBeat('Blackout', "Mara's phone dims, flashes and speaks the alert.", ['mara'])
  d('mara')?.defaultView?.scrollTo(0, 0)
  highlight(d('mara'), [find(d('mara'), 'section[role="alert"]')], false)
  await waitFor(() => api.spoken().some((t) => t.startsWith('The power is out on Level 38')), 4000)
  await speechIdle(15_000)
  api.check('blackout alert spoken aloud', api.spoken().some((t) => t.startsWith('The power is out on Level 38')))
  await sleep(3000)

  // 4 · A message with no network
  api.setBeat('Message', 'With no network on her level, Mara taps POWER OUT.', ['mara'])
  const powerOut = find(d('mara'), 'button', /^Power out$/)
  highlight(d('mara'), [powerOut])
  await sleep(2500)
  click(powerOut)
  await sleep(1500)

  api.setBeat('Message', "Neighbors' phones pass it up to Ilan, and his phone reads it out.", ['ilan'])
  const msg = await waitFor(() => find(d('ilan'), 'li', /Power is out here\./), 10_000)
  highlight(d('ilan'), [msg])
  await waitFor(() => api.spoken().includes('Message from Mara. Power is out here.'), 4000)
  await speechIdle(10_000)
  api.check("message reaches Ilan 'passed along by 1 phone' and is read aloud", /passed along by 1 phone/i.test(textOf(msg)) && api.spoken().includes('Message from Mara. Power is out here.'), textOf(msg).slice(0, 90))
  await sleep(2500)

  // 5 · Outbreak vs the official number
  api.setBeat('Outbreak', 'Fever spreads through the deep levels.', ['board'])
  clearHighlights(d('ilan'))
  clearHighlights(d('mara'))
  sim.click(/Symptom spike/)
  const boardDoc = () => d('board')
  highlight(boardDoc(), [find(boardDoc(), 'tr', /^L34\b/)])
  await sim.step(8, 450)
  await sleep(4000)

  api.setBeat('Outbreak', 'The public board turns Levels 34 to 40 red.', ['board'])
  const rows = [34, 35, 36, 37, 38, 39, 40].map((n) => find(boardDoc(), 'tr', new RegExp(`^L${n}\\b`)))
  highlight(boardDoc(), rows)
  api.check('board: L34–L40 in DANGER', rows.every((r) => /danger/i.test(textOf(r))))
  await sleep(8000)

  const l38 = await waitFor(() => find(section(boardDoc(), /^Outbreak watch$/), 'li', /Level 38 · outbreak/i), 8000)
  const m = textOf(l38).match(/Lantern\s*([\d.]+)%.*?Official\s*([\d.]+)%/i)
  const lan = m ? Math.round(Number(m[1])) : NaN
  const off = m ? Number(m[2]).toFixed(1) : '?'
  api.setBeat('Outbreak', `Residents report ${lan}% sick on Level 38 — the Directorate says ${off}%.`, ['board'])
  highlight(boardDoc(), [l38])
  api.check('outbreak: Lantern vs lower official figure', !!m && Number(m[1]) > 2 * Number(m[2]), m ? `${m[1]}% vs ${m[2]}%` : textOf(l38).slice(0, 60))
  await sleep(10_000)

  // 6 · Allocation vs the Directorate
  api.setBeat('Allocation', "Lantern: send reserve power to Level 38's air pumps first.", ['board'])
  const rec = find(boardDoc(), 'section[aria-labelledby="rec-h"]')
  highlight(boardDoc(), [rec])
  api.check('allocation: Level 38 air pumps first', /Level 38 air pumps/i.test(textOf(rec)))
  await sleep(8000)

  api.setBeat('Allocation', 'The Directorate sent most of it to its own districts.', ['board'])
  const dir = find(boardDoc(), 'section[aria-labelledby="dir-h"]')
  highlight(boardDoc(), [dir])
  api.check('allocation: Directorate → Levels 1–3', /Levels 1–3 administrative/i.test(textOf(dir)))
  await sleep(8000)

  // 7 · A vouched warden confirms
  api.setBeat('Warden', 'A warden vouched for by three neighbors confirms the outbreak.', ['board'])
  const confirmBtn = await waitFor(() => {
    const b = find<HTMLButtonElement>(d('warden'), 'button', /^Confirm outbreak$/)
    return b && !b.disabled ? b : null
  }, 10_000)
  click(confirmBtn)
  const confirmed = await waitFor(() => find(boardDoc(), 'li', /Level 38 · outbreak.*confirmed by warden W-38/i), 8000)
  highlight(boardDoc(), [confirmed])
  api.check('vouched warden confirmation shown on the board', !!confirmed)
  await sleep(9000)

  // 8 · Impostor
  api.setBeat('Impostor', 'An impostor claims to be that warden — no one vouched for its key.', ['board'])
  sim.click(/Impostor warden confirms outbreak on L38/)
  const rejected = await waitFor(() => find(boardDoc(), 'li', /W-38-WAR confirms outbreak · unverified warden, rejected/i), 8000)
  highlight(boardDoc(), [rejected])
  await sleep(7000)
  api.setBeat('Impostor', 'The public board rejects it.', ['board'])
  api.check('impostor rejected (unverified warden)', !!rejected)
  await sleep(6000)

  // 9 · Fake flood
  api.setBeat('Trust', 'A rogue phone floods Level 5 with 300 fake reports.', ['board'])
  choose(find<HTMLSelectElement>(d('sim'), 'select'), '5')
  await raw(200)
  sim.click(/inject 300 fake reports/)
  const held = await waitFor(() => find(boardDoc(), 'li', /L5 · 300 reports · held, not counted/i), 8000)
  highlight(boardDoc(), [held])
  await sleep(6000)
  api.setBeat('Trust', 'They are held back, not counted.', ['board'])
  api.check('fake reports held back', !!held)
  await sleep(7000)

  // 10 · Closing card
  api.setBeat('', '', [])
  api.setCard('closing')
  await sleep(12_000)
}
