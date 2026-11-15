import { Card, Explain, StateTag, Trust } from '../../components/ui'
import { PURPOSE_LABEL, type AllocationPlan } from '../../lib/allocation'
import type { Tally } from '../../lib/votes'
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

export function AllocationPanel({ plan, bulletin, tally }: { plan: AllocationPlan; bulletin: DirectorateBulletin | null; tally: Tally }) {
  const used = plan.allocations.reduce((a, x) => a + x.mw, 0)
  const match = bulletin && plan.allocations.length > 0 ? matchShare(plan, bulletin) : null

  return (
    <Card
      title={`Power reserve · ${plan.reserveMW} MW`}
      right={match !== null && <StateTag state={match < 0.5 ? 'danger' : 'normal'}>{Math.round(match * 100)}% matched</StateTag>}
      help="Lantern shares the Directorate's spare power by the community's priorities, weighted by need and people affected. '% matched' = how much of the reserve the Directorate actually sent where the community plan says it's needed. Priorities are ranked by every level once a day and tallied by Borda count; anyone can recount the raw ballots."
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase">
        <span className="text-hollow-300">Priorities:</span>
        {tally.order.map((p, i) => (
          <span key={p} className="font-bold">
            <span className="text-lamp">{i + 1}</span> {p}
            {i < tally.order.length - 1 && <span className="text-hollow-500"> ›</span>}
          </span>
        ))}
        <Trust tone={tally.voters ? 'ok' : 'warn'}>
          {tally.voters ? `Voted by ${tally.voters} of 40 levels` : 'No ballots yet'}
        </Trust>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section aria-labelledby="rec-h" className="border-2 border-lamp">
          <h3 id="rec-h" className="bg-lamp px-2 py-1 font-mono text-xs font-bold tracking-[0.12em] text-hollow-950 uppercase">
            Lantern recommends
          </h3>
          <ul className="divide-y divide-hollow-800 font-mono text-sm uppercase">
            {plan.allocations.length === 0 && <li className="px-2 py-1.5 text-hollow-300">Hold reserve</li>}
            {plan.allocations.map((a) => (
              <li key={`${a.level}-${a.purpose}`} className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span>
                  <b className="text-data">{a.mw.toFixed(1)} MW</b> → Level {a.level} {PURPOSE_LABEL[a.purpose]}
                </span>
                <Explain label={`Why level ${a.level} ${a.purpose}`}>{a.reason}</Explain>
              </li>
            ))}
            {plan.allocations.length > 0 && plan.reserveMW - used >= 0.5 && (
              <li className="px-2 py-1.5 text-hollow-500">{(plan.reserveMW - used).toFixed(1)} MW held</li>
            )}
          </ul>
          {plan.unmet.length > 0 && (
            <div className="px-2 py-1">
              <StateTag state="watch">Unmet: {plan.unmet.map((u) => `L${u.level} ${u.purpose}`).join(', ')}</StateTag>
            </div>
          )}
        </section>

        <section aria-labelledby="dir-h" className="border-2 border-hollow-500">
          <h3 id="dir-h" className="bg-hollow-800 px-2 py-1 font-mono text-xs font-bold tracking-[0.12em] text-hollow-300 uppercase">
            Directorate did
          </h3>
          {!bulletin ? (
            <p className="px-2 py-1.5 font-mono text-xs text-hollow-500 uppercase">No bulletin</p>
          ) : (
            <ul className="divide-y divide-hollow-800 font-mono text-sm uppercase">
              {bulletin.allocations.map((d) => (
                <li key={d.label} className={`px-2 py-1.5 ${d.purpose === 'administration' ? 'text-danger' : ''}`}>
                  <b>{d.mw.toFixed(1)} MW</b> → {d.label}
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 px-2 py-1.5 text-hollow-500">
                <span>Official statement</span>
                <Explain label="Directorate statement">“{bulletin.statement}”</Explain>
              </li>
            </ul>
          )}
        </section>
      </div>
    </Card>
  )
}
