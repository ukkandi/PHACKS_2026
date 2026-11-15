import { Button, Card } from '../../components/ui'
import { PURPOSE_LABEL, type AllocationPlan, type Purpose } from '../../lib/allocation'
import type { DirectorateBulletin } from '../../sim/directorate'

function matchShare(plan: AllocationPlan, bulletin: DirectorateBulletin): number {
  // MW the Directorate sent to a (level, purpose) the community plan also funds.
  let matched = 0
  for (const d of bulletin.allocations) {
    if (d.purpose === 'administration') continue
    for (const level of d.levels) {
      const rec = plan.allocations.find((a) => a.level === level && a.purpose === d.purpose)
      if (rec) matched += Math.min(rec.mw, d.mw / d.levels.length)
    }
  }
  return bulletin.reserveMW > 0 ? matched / bulletin.reserveMW : 0
}

export function AllocationPanel({
  plan,
  bulletin,
  priorities,
  onPriorities,
  readOnly,
}: {
  plan: AllocationPlan
  bulletin: DirectorateBulletin | null
  priorities: Purpose[]
  onPriorities: (p: Purpose[]) => void
  readOnly?: boolean
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...priorities]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onPriorities(next)
  }
  const used = plan.allocations.reduce((a, x) => a + x.mw, 0)

  return (
    <Card
      title={`Power reserve · ${plan.reserveMW} MW`}
      right={<span className="text-xs text-hollow-500">recommendation vs what the Directorate did</span>}
    >
      <div className="mb-4">
        <div className="mb-1 text-xs text-hollow-500 uppercase">Published community priorities</div>
        <ol className="flex flex-wrap gap-2">
          {priorities.map((p, i) => (
            <li key={p} className="flex items-center gap-1 rounded-lg border border-hollow-700 bg-hollow-800 px-2 py-1 text-sm">
              <span className="font-bold text-lamp">#{i + 1}</span> {p}
              {!readOnly && (
                <span className="ml-1 flex">
                  <Button tone="ghost" className="!min-h-8 !px-2" aria-label={`Raise ${p}`} disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button
                    tone="ghost"
                    className="!min-h-8 !px-2"
                    aria-label={`Lower ${p}`}
                    disabled={i === priorities.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="rec-h">
          <h3 id="rec-h" className="mb-2 font-semibold text-lamp">
            Lantern recommends
          </h3>
          {plan.allocations.length === 0 ? (
            <p className="text-sm text-hollow-300">No urgent needs reported. Keep the reserve.</p>
          ) : (
            <ul className="space-y-2">
              {plan.allocations.map((a) => (
                <li key={`${a.level}-${a.purpose}`} className="rounded-lg bg-lamp/10 p-2 text-sm">
                  <div className="font-semibold">
                    {a.mw.toFixed(1)} MW → Level {a.level} {PURPOSE_LABEL[a.purpose]}
                  </div>
                  <div className="text-hollow-300">{a.reason}</div>
                </li>
              ))}
              {plan.reserveMW - used >= 0.5 && (
                <li className="text-sm text-hollow-300">{(plan.reserveMW - used).toFixed(1)} MW held in reserve.</li>
              )}
            </ul>
          )}
          {plan.unmet.length > 0 && (
            <p className="mt-2 text-sm text-warn">
              Unmet: {plan.unmet.map((u) => `L${u.level} ${u.purpose} (${u.needMW} MW)`).join(', ')}.
            </p>
          )}
        </section>

        <section aria-labelledby="dir-h">
          <h3 id="dir-h" className="mb-2 font-semibold text-hollow-300">
            Directorate actually did
          </h3>
          {!bulletin ? (
            <p className="text-sm text-hollow-500">No bulletin received.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {bulletin.allocations.map((d) => (
                  <li
                    key={d.label}
                    className={`rounded-lg p-2 text-sm ${d.purpose === 'administration' ? 'bg-danger/10' : 'bg-hollow-800'}`}
                  >
                    <div className="font-semibold">
                      {d.mw.toFixed(1)} MW → {d.label}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-hollow-300">“{bulletin.statement}”</p>
              {plan.allocations.length > 0 && (
                <p className="mt-2 text-sm">
                  <strong className={matchShare(plan, bulletin) < 0.5 ? 'text-danger' : 'text-ok'}>
                    {Math.round(matchShare(plan, bulletin) * 100)}%
                  </strong>{' '}
                  of the reserve went where the community's priorities say it is needed.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </Card>
  )
}
