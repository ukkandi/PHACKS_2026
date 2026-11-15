import { Card, Explain, StateTag, Trust } from '../../components/ui'
import type { LedgerView } from '../../lib/ledger'
import type { DirectorateBulletin } from '../../sim/directorate'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`

export function OutbreakPanel({ view, bulletin }: { view: LedgerView; bulletin: DirectorateBulletin | null }) {
  const flagged = view.levels
    .filter((l) => l.outbreak.status === 'outbreak' || l.outbreak.status === 'watch')
    .sort((a, b) => b.outbreak.z - a.outbreak.z)

  return (
    <Card
      title="Outbreak watch"
      help="Share of each level's recent check-ins reporting fever, cough, breathing or stomach trouble, tested against that level's own normal rate. OUTBREAK = far beyond chance. OFFICIAL = the Directorate's published figure for the same level."
    >
      {flagged.length === 0 ? (
        <StateTag state="normal">No outbreak</StateTag>
      ) : (
        <ul className="divide-y-2 divide-hollow-800">
          {flagged.map((l) => {
            const official = bulletin?.levels[l.level - 1]
            const verified = l.verifications.find((v) => v.claim === 'outbreak')
            const ratio = official ? l.outbreak.rate / Math.max(official.symptomRate, 0.001) : 0
            const danger = l.outbreak.status === 'outbreak'
            return (
              <li key={l.level} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StateTag state={danger ? 'danger' : 'watch'} className="text-sm">
                    Level {l.level} · {danger ? 'outbreak' : 'watch'}
                  </StateTag>
                  <span className="flex items-center gap-2">
                    {verified && (
                      <StateTag state={verified.confirmed ? 'normal' : 'watch'}>
                        {verified.confirmed ? '✓ confirmed' : '✗ disputed'} by warden {verified.badge}
                      </StateTag>
                    )}
                    <Explain label={`Why level ${l.level}`}>{l.outbreak.reason}</Explain>
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 font-mono uppercase">
                  <div>
                    <div className="text-xs tracking-[0.15em] text-data">Lantern</div>
                    <div className="text-2xl font-bold text-data">{pct(l.outbreak.rate)}</div>
                  </div>
                  <div>
                    <div className="text-xs tracking-[0.15em] text-hollow-500">Official</div>
                    <div className="text-2xl font-bold text-hollow-500">{official ? pct(official.symptomRate) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs tracking-[0.15em] text-hollow-500">Gap</div>
                    <div className={`text-2xl font-bold ${ratio >= 1.5 ? 'text-warn' : 'text-hollow-300'}`}>
                      {official ? `${ratio.toFixed(1)}× lower` : '—'}
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4">
                  <Trust>Based on {l.reports} reports</Trust>
                  <Trust tone={l.confidence === 'high' ? 'ok' : 'warn'}>{l.confidence} confidence</Trust>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
