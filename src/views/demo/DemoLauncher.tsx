// Demo-only launcher (served at / and /demo): a plain list of the demo's tabs. Not part of Lantern.
import { useEffect } from 'react'
import { Shell } from '../../components/Shell'
import { Button, Explain } from '../../components/ui'
import { resetDemo } from '../../lib/demoReset'

const TABS = [
  { key: 'ledger', label: 'Public ledger', path: '/ledger', who: 'Everyone' },
  { key: 'sim', label: 'World Simulator', path: '/sim', who: 'Demo only' },
  { key: 'mara', label: 'Mara · L38', path: '/resident?device=mara&as=mara', who: 'Phone' },
  { key: 'teo', label: 'Teo · L36', path: '/resident?device=teo&as=teo', who: 'Phone' },
  { key: 'ilan', label: 'Ilan · L12', path: '/resident?device=ilan&as=ilan', who: 'Phone' },
  { key: 'terminal', label: 'L38 terminal', path: '/terminal?level=38', who: 'Shared device' },
  { key: 'warden', label: 'Warden · L38', path: '/warden?level=38&device=warden38', who: 'Warden' },
  { key: 'directorate', label: 'Directorate', path: '/directorate', who: 'Read-only' },
]

const STEPS = [
  'Warden tab: ACTIVE · VOUCHED BY 3 OF L38 (Mara + 2 level-phone residents; Teo is L36, not counted).',
  "Mara, Teo, Ilan: I'M OKAY → SEND NOW (or HOLD TO SPEAK). Ilan: Spoken alerts → ON. Ilan's family list: all OKAY.",
  'Simulator: Power surge, Step +1h ×4 → Mara: BLACKOUT RISK with hours + confidence; Ilan: L38 RISK.',
  'Step +1h ×9 → Mara: blackout mode, flashes and SPEAKS the alert. Mara: POWER OUT (or hold to speak "power out" → CONFIRM) → Ilan gets it passed along by 1 phone and hears it read aloud.',
  'Simulator: Symptom spike, Step +1h ×8 → ledger: L38 OUTBREAK vs lower OFFICIAL figure.',
  'Ledger: Power reserve — Lantern: L38 AIR PUMPS; Directorate: most to L1–3. Priorities voted by 40 levels.',
  'Terminal: 2 2 1 → NEXT → I NEED HELP → LOW → UNDER 5 H → BREATHING → NEXT → YES. Warden: Mrs. Okafor first; CHECK IN Mr. Brandt → SEND; CONFIRM OUTBREAK.',
  'Simulator (L38): Impostor warden confirms outbreak → ledger HELD BACK: unverified warden, rejected.',
  'Simulator: target Level 5 → Rogue device → ledger HELD BACK.',
  'Directorate tab: same board, read-only.',
]

export function DemoLauncher() {
  useEffect(() => {
    document.title = 'Demo launcher'
  }, [])
  const openAll = () => {
    // Named targets: clicking again re-uses the same tabs instead of opening duplicates.
    for (const t of TABS) window.open(t.path, `lantern-${t.key}`)
  }
  return (
    <Shell view="demo" simulator>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between gap-2 border-2 border-dashed border-sim px-3 py-2">
          <h1 className="font-mono text-sm font-bold tracking-[0.12em] text-sim uppercase">Demo launcher · not part of Lantern</h1>
          <Explain label="About the demo">
            Each browser tab is a separate device. Tabs can open in any order: each catches up from the mesh when it joins.
            Reset wipes every open tab and puts the world back to Day 1, 00:00 (paused, Level 38).
          </Explain>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            tone="danger"
            className="min-h-14"
            onClick={() => {
              if (confirm('Wipe ALL demo data in every open tab and start the demo from the beginning?')) void resetDemo()
            }}
          >
            Reset &amp; set up demo
          </Button>
          <Button tone="primary" className="min-h-14" onClick={openAll}>
            Open all 8 tabs
          </Button>
        </div>

        <ol className="border-2 border-hollow-700">
          {TABS.map((t, i) => (
            <li key={t.key} className="border-b border-hollow-800 last:border-b-0">
              <a
                href={t.path}
                target={`lantern-${t.key}`}
                className="flex min-h-12 items-center gap-3 px-3 font-mono text-sm uppercase hover:bg-hollow-800"
              >
                <span className="w-6 text-lamp">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1 font-bold tracking-wider">{t.label}</span>
                <span className="text-xs text-hollow-500">{t.who}</span>
              </a>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between border-2 border-hollow-700 px-3 py-2">
          <span className="font-mono text-xs tracking-[0.12em] text-hollow-300 uppercase">Script · Step +1h, clock paused</span>
          <Explain label="Demo script">
            <ol className="list-decimal space-y-1 pl-5">
              {STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Explain>
        </div>
      </div>
    </Shell>
  )
}
