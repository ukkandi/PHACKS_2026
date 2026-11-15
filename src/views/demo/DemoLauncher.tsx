// Demo-only: opens every tab of the demo and resets everything. Not part of Lantern.
import { useEffect } from 'react'
import { Shell } from '../../components/Shell'
import { Button } from '../../components/ui'
import { resetDemo } from '../../lib/demoReset'

const TABS = [
  { key: 'ledger', label: 'Public ledger', path: '/ledger', note: 'Everyone' },
  { key: 'sim', label: 'World Simulator', path: '/sim', note: 'Demo only — drives the world' },
  { key: 'mara', label: 'Mara · Level 38', path: '/resident?device=mara&as=mara', note: 'Resident phone' },
  { key: 'teo', label: 'Teo · Level 36', path: '/resident?device=teo&as=teo', note: 'Resident phone' },
  { key: 'ilan', label: 'Ilan · Level 12', path: '/resident?device=ilan&as=ilan', note: 'Resident phone' },
  { key: 'terminal', label: 'Level 38 terminal', path: '/terminal?level=38', note: 'Shared device' },
  { key: 'warden', label: 'Warden · Level 38', path: '/warden?level=38&device=warden38', note: 'Block warden' },
  { key: 'directorate', label: 'Directorate view', path: '/directorate', note: 'Read-only' },
]

const STEPS = [
  'Mara, Teo, Ilan: click Check in. Ilan sees everyone “Okay today”.',
  'Simulator: Power surge, then Step +1h ×4 → Mara’s blackout warning (window + confidence); Ilan sees the L38 alert.',
  'Step +1h ×9 → blackout. Mara: “Power is out here.” → reaches Ilan via L38 ⇢radio L36 ⇢net L12.',
  'Simulator: Symptom spike, then Step +1h ×8 → ledger: L38 outbreak vs the lower official figure.',
  'Ledger: Power reserve — Lantern recommends L38 air pumps; Directorate sent most to Levels 1–3. Priorities voted by 40 levels.',
  'Terminal: 2 2 1 → Next → I need help → Low → Under 5 hours → Breathing → Next → Yes. Warden: Mrs. Okafor first; check in Mr. Brandt; Confirm outbreak.',
  'Simulator: Level 5 → Rogue device → ledger holds the fake reports back.',
  'Directorate tab: the same numbers, read-only.',
]

export function DemoLauncher() {
  useEffect(() => {
    document.title = 'Demo launcher (demo only)'
  }, [])
  const openAll = () => {
    // Named targets: clicking again re-uses the same tabs instead of opening duplicates.
    for (const t of TABS) window.open(t.path, `lantern-${t.key}`)
  }
  return (
    <Shell view="demo launcher" simulator>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-xl border-2 border-dashed border-sim/60 bg-sim/5 p-4">
          <h1 className="font-mono text-xl font-bold text-sim uppercase">Demo launcher — not part of Lantern</h1>
          <p className="mt-1 text-sm">
            Opens every tab of the judges' demo. Tabs can open in any order: each one catches up from the mesh when it
            joins. Each browser tab is a separate device.
          </p>
        </section>

        <section aria-labelledby="setup-h" className="space-y-3">
          <h2 id="setup-h" className="text-lg font-semibold">
            1 · Start clean
          </h2>
          <Button
            tone="danger"
            className="min-h-14 text-base"
            onClick={() => {
              if (confirm('Wipe ALL demo data in every open tab and start the demo from the beginning?')) void resetDemo()
            }}
          >
            Reset &amp; set up demo
          </Button>
          <p className="text-sm text-hollow-300">
            Clears every tab's data, puts the world back to Day 1, 00:00 (paused, Level 38 selected) and reloads all open
            demo tabs into their starting state.
          </p>
        </section>

        <section aria-labelledby="tabs-h" className="space-y-3">
          <h2 id="tabs-h" className="text-lg font-semibold">
            2 · Open the tabs
          </h2>
          <Button tone="primary" className="min-h-14 text-base" onClick={openAll}>
            Open all 8 tabs
          </Button>
          <p className="text-sm text-hollow-300">
            If only one tab opens, allow pop-ups for this site and click again — or open them one by one:
          </p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {TABS.map((t, i) => (
              <li key={t.key}>
                <a
                  href={t.path}
                  target={`lantern-${t.key}`}
                  className="flex min-h-14 items-center gap-3 rounded-lg border border-hollow-700 bg-hollow-900 px-3 hover:border-lamp"
                >
                  <span className="font-mono text-lamp">{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{t.label}</span>
                    <span className="block text-xs text-hollow-300">{t.note}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="script-h">
          <h2 id="script-h" className="mb-2 text-lg font-semibold">
            3 · Run the script
          </h2>
          <p className="mb-2 text-sm text-hollow-300">Keep the simulator clock Paused; use Step +1h. Full script in README.md.</p>
          <ol className="list-decimal space-y-2 pl-6 text-sm">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      </div>
    </Shell>
  )
}
