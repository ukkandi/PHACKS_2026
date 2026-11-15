import { Fragment, useState } from 'react'
import { Badge, Card } from '../../components/ui'
import type { LedgerView, LevelView } from '../../lib/ledger'
import type { DirectorateBulletin } from '../../sim/directorate'
import { formatHoursRange } from '../../sim/predict'
import { ConfidenceBadge } from './bits'

const pct = (v: number) => `${Math.round(v * 100)}%`

function powerCell(l: LevelView) {
  const a = l.alert
  if (l.conditions?.powerOut || a?.band === 'blackout') return <span className="font-bold text-danger">BLACKOUT</span>
  if (a && (a.band === 'warning' || a.band === 'critical'))
    return (
      <span className={a.band === 'critical' ? 'text-danger' : 'text-warn'}>
        {a.riskPct}% · {formatHoursRange(a.hoursRange)}
      </span>
    )
  return <span className="text-hollow-500">ok</span>
}

function outbreakCell(l: LevelView) {
  const o = l.outbreak
  const tone = o.status === 'outbreak' ? 'text-danger font-bold' : o.status === 'watch' ? 'text-warn' : 'text-hollow-300'
  return o.status === 'insufficient' ? <span className="text-hollow-500">—</span> : <span className={tone}>{(o.rate * 100).toFixed(1)}%</span>
}

export function HollowMap({ view, bulletin }: { view: LedgerView; bulletin: DirectorateBulletin | null }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <Card title="The Hollow, level by level" right={<span className="text-xs text-hollow-500">L1 = top · L40 = deepest</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left font-mono text-xs">
          <caption className="sr-only">
            Per-level figures from anonymous check-ins in the last 12 hours, with the number of reports behind each.
          </caption>
          <thead className="text-hollow-300">
            <tr>
              <th scope="col" className="px-2 py-1">Level</th>
              <th scope="col" className="px-2 py-1">Based on</th>
              <th scope="col" className="px-2 py-1">Blackout</th>
              <th scope="col" className="px-2 py-1">Symptoms</th>
              <th scope="col" className="px-2 py-1">Official</th>
              <th scope="col" className="px-2 py-1">Bad water</th>
              <th scope="col" className="px-2 py-1">Low mood</th>
              <th scope="col" className="px-2 py-1">Temp · air</th>
            </tr>
          </thead>
          <tbody>
            {view.levels.map((l) => {
              const off = bulletin?.levels[l.level - 1]
              const isOpen = open === l.level
              return (
                <Fragment key={l.level}>
                  <tr
                    className={`border-t border-hollow-800 ${
                      l.outbreak.status === 'outbreak' || l.conditions?.powerOut ? 'bg-danger/10' : ''
                    }`}
                  >
                    <th scope="row" className="px-2 py-1">
                      <button
                        type="button"
                        className="min-h-8 font-bold underline decoration-dotted"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : l.level)}
                      >
                        L{l.level}
                      </button>
                    </th>
                    <td className={`px-2 py-1 ${l.reports < 20 ? 'text-warn' : ''}`}>
                      {l.reports} report{l.reports === 1 ? '' : 's'}
                      {l.heldBack.length > 0 && <span className="text-danger"> · {l.heldBack.length} held</span>}
                    </td>
                    <td className="px-2 py-1">{powerCell(l)}</td>
                    <td className="px-2 py-1">{outbreakCell(l)}</td>
                    <td className="px-2 py-1 text-hollow-500">{off ? `${(off.symptomRate * 100).toFixed(1)}%` : '—'}</td>
                    <td className={`px-2 py-1 ${l.waterBadShare >= 0.2 ? 'font-bold text-danger' : ''}`}>
                      {l.reports ? pct(l.waterBadShare) : '—'}
                      {off?.water === 'safe' && l.waterBadShare >= 0.2 && <span className="text-hollow-500"> (official: safe)</span>}
                    </td>
                    <td className={`px-2 py-1 ${l.lowMoodShare >= 0.4 ? 'text-warn' : ''}`}>{l.reports ? pct(l.lowMoodShare) : '—'}</td>
                    <td className="px-2 py-1 text-hollow-300">
                      {l.conditions ? `${l.conditions.temperature.toFixed(0)}° · ${Math.round(l.conditions.air)}` : '—'}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-hollow-800/60">
                      <td colSpan={8} className="px-3 py-2 font-sans text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <ConfidenceBadge c={l.confidence} />
                          <span className="text-hollow-300">
                            Sources:{' '}
                            {Object.entries(l.bySource)
                              .map(([k, v]) => `${v} via ${k === 'standin' ? 'level phones' : k}`)
                              .join(', ') || 'none'}
                          </span>
                        </div>
                        <p className="mt-1">{l.outbreak.reason}</p>
                        {l.reports > 0 && (
                          <p className="mt-1 text-hollow-300">
                            Avg mood {l.avgMood.toFixed(1)}/5 · avg sleep {l.avgSleep.toFixed(1)}h · {l.counts.help} asked for help
                          </p>
                        )}
                        {l.alert && l.alert.band !== 'clear' && <p className="mt-1 text-hollow-300">Power: {l.alert.reason}</p>}
                        {l.verifications.map((v) => (
                          <p key={v.id} className="mt-1">
                            <Badge tone={v.confirmed ? 'ok' : 'warn'}>
                              Warden {v.badge} {v.confirmed ? 'confirms' : 'disputes'} {v.claim}
                            </Badge>{' '}
                            {v.note}
                          </p>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
