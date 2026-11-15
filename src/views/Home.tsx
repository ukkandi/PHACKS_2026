import { Link } from 'react-router-dom'
import { Shell } from '../components/Shell'

const views = [
  { to: '/resident', name: 'Resident', who: 'Your phone', desc: 'Daily check-in, family status, warnings.' },
  { to: '/terminal', name: 'Level terminal', who: 'Shared device', desc: 'Big-button check-in by unit number.' },
  { to: '/warden', name: 'Warden', who: 'Block warden', desc: 'Check in for neighbours, verify reports.' },
  { to: '/ledger', name: 'Public ledger', who: 'Everyone', desc: 'Anonymous per-level picture of the Hollow.' },
  { to: '/directorate', name: 'Directorate', who: 'Read-only', desc: 'Same aggregates as the public. No more.' },
]

export function Home() {
  return (
    <Shell view="home">
      <p className="mb-6 max-w-2xl text-hollow-300">
        A community-owned, offline-first wellbeing network for the Hollow. One daily check-in. Everything
        else is derived from it — on your device, shared only as anonymous level totals.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {views.map((v) => (
          <li key={v.to}>
            <Link
              to={v.to}
              className="block h-full rounded-xl border border-hollow-700 bg-hollow-900 p-4 hover:border-lamp"
            >
              <div className="text-lg font-semibold text-white">{v.name}</div>
              <div className="text-xs text-lamp uppercase">{v.who}</div>
              <p className="mt-2 text-sm text-hollow-300">{v.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 rounded-xl border-2 border-dashed border-sky-400/50 p-4 text-sm">
        <Link to="/sim" className="font-mono font-bold text-sky-300 underline">
          ⚙ World Simulator
        </Link>{' '}
        <span className="text-hollow-300">
          — demo only, not part of Lantern. Drives the fictional world (surges, blackouts, outbreaks). Each browser tab
          is a separate device: open several <code>/resident</code> tabs plus the simulator.
        </span>
      </div>
    </Shell>
  )
}
