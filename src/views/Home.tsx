import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LanternMark } from '../components/LanternMark'
import { WINDOW } from '../lib/ledger'
import { useWorld } from '../lib/worldFeed'
import { useLedger } from '../stores/ledgerStore'
import { tickLabel } from '../sim/world'

const STEPS = [
  {
    n: '01',
    title: 'Check in',
    body: "Thirty seconds a day: I'm okay or I need help, mood, sleep, symptoms, is the water okay.",
  },
  {
    n: '02',
    title: 'It stays with you',
    body: 'Your answers live on your device. Your family sees your status — encrypted with your family code.',
  },
  {
    n: '03',
    title: 'Counted, never tracked',
    body: 'Only anonymous level totals leave your device. Together they become a public ledger nobody can switch off.',
  },
]

const FEATURES = [
  {
    title: 'Blackout warnings, hours ahead',
    body: "Your phone reads your level's power meter and warns you with a time window — before the Directorate says a word.",
  },
  {
    title: 'Works when the network doesn’t',
    body: "Messages hop phone to phone through neighbouring levels when the Directorate's network is down.",
  },
  {
    title: 'Outbreaks, not cover-ups',
    body: 'Symptom check-ins reveal outbreaks early — shown next to the official figure, so everyone sees the gap.',
  },
  {
    title: 'Fair power, set by the community',
    body: 'Levels vote on what matters most — air, water, cooling, light. Lantern recommends where reserve power should go.',
  },
  {
    title: 'No phone? No problem',
    body: 'Shared level terminals and block wardens bring everyone in — and wardens see who to visit first.',
  },
  {
    title: 'Can’t be shut down or traced',
    body: 'No central server, no accounts, no names on the ledger. Nothing to subpoena, nothing to switch off.',
  },
]

const WAYS_IN = [
  { to: '/resident', name: 'Your phone', desc: 'Check in, family, warnings, your sleep & mood.' },
  { to: '/terminal', name: 'Level terminal', desc: 'Big buttons, unit number, no account. Clears after use.' },
  { to: '/warden', name: 'Warden', desc: 'Check in neighbours, triage care, verify the ledger.' },
  { to: '/ledger', name: 'Public ledger', desc: 'Every level, anonymised, next to the official story.' },
  { to: '/directorate', name: 'Directorate', desc: 'Read-only. The same numbers as everyone. No more.' },
]

const PRINCIPLES = ['Privacy by design', 'Offline-first', 'Runs on devices people already have', 'Open, verifiable numbers']

function LiveStrip() {
  const world = useWorld()
  const summaries = useLedger((s) => s.summaries)
  const live = useMemo(() => {
    if (!world) return null
    const recent = summaries.filter((s) => world.tick - s.tick < WINDOW && s.tick <= world.tick)
    const reports = recent.reduce((a, s) => a + s.counts.reports, 0)
    const levels = new Set(recent.map((s) => s.level)).size
    return reports > 0 ? { reports, levels, when: tickLabel(world.tick) } : null
  }, [world, summaries])
  if (!live) return null
  return (
    <p className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-hollow-700 bg-hollow-900/80 px-4 py-2 font-mono text-xs text-hollow-300">
      <span className="inline-block size-2 rounded-full bg-ok" aria-hidden />
      <span>Live from the ledger</span>
      <span className="text-data">{live.reports.toLocaleString()} check-ins</span>
      <span>· {live.levels} levels · last 12h · {live.when}</span>
    </p>
  )
}

export function Home() {
  useEffect(() => {
    document.title = 'Lantern — one check-in a day, a Hollow that can see itself'
  }, [])

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <LanternMark size={32} /> Lantern
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1 text-sm">
          <a href="#how" className="rounded-lg px-3 py-2 text-hollow-300 hover:text-cream">
            How it works
          </a>
          <Link to="/ledger" className="rounded-lg px-3 py-2 text-hollow-300 hover:text-cream">
            Public ledger
          </Link>
          <Link to="/resident" className="rounded-xl bg-lamp px-4 py-2 font-semibold text-hollow-950 hover:brightness-110">
            Check in
          </Link>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-16 md:grid-cols-[1.3fr_1fr] md:pt-16">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-lamp uppercase">The Hollow · 2087 · 2 billion people underground</p>
            <h1 className="mt-4 text-4xl leading-[1.05] font-bold sm:text-6xl">
              One check-in a day.
              <br />
              <span className="text-lamp">A Hollow that can see itself.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-hollow-300">
              Lantern is a community-owned, offline-first wellbeing network. Check in once a day — Lantern turns it into
              blackout warnings, outbreak alerts and fair power, without ever exposing who you are.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/resident"
                className="inline-flex min-h-12 items-center rounded-xl bg-lamp px-6 font-semibold text-hollow-950 shadow-[0_0_32px_-6px_rgb(242_163_58/0.7)] hover:brightness-110"
              >
                Check in →
              </Link>
              <Link
                to="/ledger"
                className="inline-flex min-h-12 items-center rounded-xl border border-hollow-500 px-6 font-medium hover:border-cream"
              >
                See the public ledger
              </Link>
            </div>
            <LiveStrip />
          </div>
          <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center">
            <div className="lantern-glow lantern-flicker absolute inset-0 rounded-full" aria-hidden />
            <LanternMark size={220} title="Lantern" />
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-h" className="border-y border-hollow-800 bg-hollow-900/60">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <p className="font-mono text-xs tracking-[0.2em] text-hollow-500 uppercase">How it works</p>
            <h2 id="how-h" className="mt-2 text-3xl font-bold">
              One action. Everything else follows.
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-2xl border border-hollow-700 bg-hollow-950 p-5">
                  <span className="font-mono text-sm text-lamp">{s.n}</span>
                  <h3 className="mt-2 text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-hollow-300">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="feat-h" className="mx-auto max-w-6xl px-4 py-14">
          <p className="font-mono text-xs tracking-[0.2em] text-hollow-500 uppercase">What it does</p>
          <h2 id="feat-h" className="mt-2 text-3xl font-bold">
            Useful to one person on day one. Powerful when a level joins.
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-2xl border border-hollow-700 bg-hollow-900 p-5">
                <span className="mb-3 block h-1 w-10 rounded-full bg-lamp" aria-hidden />
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-hollow-300">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Ways in */}
        <section aria-labelledby="ways-h" className="border-t border-hollow-800 bg-hollow-900/60">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <p className="font-mono text-xs tracking-[0.2em] text-hollow-500 uppercase">Ways in</p>
            <h2 id="ways-h" className="mt-2 text-3xl font-bold">
              Phone, terminal or warden — everyone counts.
            </h2>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {WAYS_IN.map((w) => (
                <li key={w.to}>
                  <Link
                    to={w.to}
                    className="group flex h-full flex-col rounded-2xl border border-hollow-700 bg-hollow-950 p-4 hover:border-lamp"
                  >
                    <span className="font-display text-lg font-bold group-hover:text-lamp">{w.name} →</span>
                    <span className="mt-1 text-sm text-hollow-300">{w.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Principles */}
        <section aria-label="Principles" className="mx-auto max-w-6xl px-4 py-10">
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 font-mono text-xs tracking-widest text-hollow-300 uppercase">
            {PRINCIPLES.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className="text-lamp" aria-hidden>
                  ◆
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl border-t border-hollow-800 px-4 py-8 text-sm text-hollow-500">
        <p>
          A fictional demo for Patriot HackFest 2026 · <em>Life Underground</em>. All data is simulated.
        </p>
        <p className="mt-3">
          <span className="font-mono text-xs tracking-wider text-sim uppercase">Demo tools — not part of Lantern:</span>{' '}
          <Link to="/sim" className="text-sim underline">
            World Simulator
          </Link>{' '}
          ·{' '}
          <Link to="/demo" className="text-sim underline">
            Demo launcher
          </Link>
        </p>
      </footer>
    </div>
  )
}
