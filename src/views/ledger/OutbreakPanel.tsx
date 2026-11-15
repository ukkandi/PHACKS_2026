import { Badge, Card } from '../../components/ui'
import type { LedgerView } from '../../lib/ledger'
import type { DirectorateBulletin } from '../../sim/directorate'
import { ConfidenceBadge } from './bits'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const people = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`)

export function OutbreakPanel({ view, bulletin }: { view: LedgerView; bulletin: DirectorateBulletin | null }) {
  const flagged = view.levels
    .filter((l) => l.outbreak.status === 'outbreak' || l.outbreak.status === 'watch')
    .sort((a, b) => b.outbreak.z - a.outbreak.z)

  return (
    <Card title="Outbreak watch" right={<span className="text-xs text-hollow-500">symptom check-ins vs normal, last 12h</span>}>
      {flagged.length === 0 ? (
        <p className="text-sm text-hollow-300">No level is reporting symptoms above its normal rate.</p>
      ) : (
        <ul className="space-y-3">
          {flagged.map((l) => {
            const official = bulletin?.levels[l.level - 1]
            const pop = l.conditions?.population ?? 0
            const verified = l.verifications.find((v) => v.claim === 'outbreak')
            return (
              <li
                key={l.level}
                className={`rounded-lg border p-3 ${l.outbreak.status === 'outbreak' ? 'border-danger/60 bg-danger/5' : 'border-warn/50'}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-lg">Level {l.level}</strong>
                  <Badge tone={l.outbreak.status === 'outbreak' ? 'danger' : 'warn'}>
                    {l.outbreak.status === 'outbreak' ? 'OUTBREAK' : 'watch'}
                  </Badge>
                  <ConfidenceBadge c={l.confidence} />
                  {verified && (
                    <Badge tone={verified.confirmed ? 'ok' : 'warn'}>
                      {verified.confirmed ? '✓ confirmed' : '✗ disputed'} by warden {verified.badge}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-hollow-500 uppercase">Lantern (community)</div>
                    <div className="text-3xl font-bold text-danger">{pct(l.outbreak.rate)}</div>
                    <div className="text-xs text-hollow-300">
                      with symptoms · based on <strong>{l.reports}</strong> reports
                      {pop > 0 && <> · ≈{people(l.outbreak.rate * pop)} people</>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-hollow-500 uppercase">Directorate official</div>
                    <div className="text-3xl font-bold text-hollow-300">{official ? pct(official.symptomRate) : '—'}</div>
                    <div className="text-xs text-hollow-300">
                      published figure{official && pop > 0 && <> · ≈{people(official.symptomRate * pop)} people</>}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-hollow-300">{l.outbreak.reason}</p>
                {official && l.outbreak.rate > official.symptomRate * 1.5 && (
                  <p className="mt-1 text-sm text-warn">
                    The official figure is {(l.outbreak.rate / Math.max(official.symptomRate, 0.001)).toFixed(1)}× lower than
                    what residents are reporting.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
