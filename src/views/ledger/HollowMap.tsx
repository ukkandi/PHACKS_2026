import { Fragment, useState } from 'react'
import { Explain, StateTag, Trust } from '../../components/ui'
import type { LedgerView } from '../../lib/ledger'
import { STATE_WORD, type State } from '../../lib/status'
import type { DirectorateBulletin } from '../../sim/directorate'
import { airCell, illnessCell, powerCell, rowState, waterCell, type Cell } from './boardState'

const color: Record<State, string> = { normal: 'text-ok', watch: 'text-warn', danger: 'text-danger' }

function C({ cell }: { cell: Cell }) {
  return <span className={cell.state === 'normal' ? 'text-cream' : `font-bold ${color[cell.state]}`}>{cell.word}</span>
}

/** Departure-board view of every level. L1 at the top, the deepest level at the bottom. */
export function HollowMap({ view, bulletin }: { view: LedgerView; bulletin: DirectorateBulletin | null }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section aria-labelledby="board-h" className="border-2 border-hollow-700 bg-black">
      <header className="flex items-center justify-between gap-2 border-b-2 border-hollow-700 px-3 py-1.5">
        <h2 id="board-h" className="font-mono text-xs font-bold tracking-[0.12em] text-lamp uppercase">
          All levels · last 12 h
        </h2>
        <Explain label="How to read the board">
          <p className="mb-1">
            Each row is one level. <b>State</b> is the worst of its columns. <b>Illness</b> = share of recent check-ins with
            symptoms (▲ = outbreak, far above that level's normal). <b>Official</b> = the Directorate's published figure.
            <b> Water</b> = share reporting bad water (* = Directorate calls it safe). <b>Reports</b> = anonymous check-ins
            behind the row.
          </p>
          <p>Click a level for its sources, warden checks and the reasoning.</p>
        </Explain>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left font-mono text-xs uppercase">
          <caption className="sr-only">Per-level states from anonymous check-ins in the last 12 hours.</caption>
          <thead className="text-[10px] tracking-[0.15em] text-hollow-500">
            <tr className="border-b border-hollow-700">
              <th scope="col" className="px-2 py-1">Lvl</th>
              <th scope="col" className="px-2 py-1">State</th>
              <th scope="col" className="px-2 py-1">Power</th>
              <th scope="col" className="px-2 py-1">Illness</th>
              <th scope="col" className="px-2 py-1">Official</th>
              <th scope="col" className="px-2 py-1">Water</th>
              <th scope="col" className="px-2 py-1">Air</th>
              <th scope="col" className="px-2 py-1 text-right">Reports</th>
            </tr>
          </thead>
          <tbody>
            {view.levels.map((l) => {
              const off = bulletin?.levels[l.level - 1]
              const st = rowState(l, off)
              const isOpen = open === l.level
              return (
                <Fragment key={l.level}>
                  <tr className="border-b border-hollow-800 odd:bg-hollow-950/60">
                    <th scope="row" className="px-2 py-1">
                      <button
                        type="button"
                        className="min-h-7 font-bold text-lamp underline decoration-dotted"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : l.level)}
                      >
                        L{l.level}
                      </button>
                    </th>
                    <td className="px-2 py-1">
                      <span className="inline-flex items-center gap-1.5">
                        {st === 'danger' && <span className="hazard inline-block h-3 w-4" aria-hidden />}
                        <span className={`font-bold ${color[st]}`}>{STATE_WORD[st]}</span>
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <C cell={powerCell(l)} />
                    </td>
                    <td className="px-2 py-1">
                      <C cell={illnessCell(l)} />
                    </td>
                    <td className="px-2 py-1 text-hollow-500">{off ? `${(off.symptomRate * 100).toFixed(1)}%` : '—'}</td>
                    <td className="px-2 py-1">
                      <C cell={waterCell(l, off)} />
                    </td>
                    <td className="px-2 py-1">
                      <C cell={airCell(l)} />
                    </td>
                    <td className={`px-2 py-1 text-right ${l.reports < 20 ? 'text-warn' : 'text-data'}`}>
                      {l.reports}
                      {l.heldBack.length > 0 && <span className="text-danger"> +{l.heldBack.length} held</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-hollow-900">
                      <td colSpan={8} className="px-3 py-2 font-sans text-sm normal-case">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <Trust>{l.confidence} confidence</Trust>
                          <Trust>
                            Sources:{' '}
                            {Object.entries(l.bySource)
                              .map(([k, v]) => `${v} via ${k === 'standin' ? 'level phones' : k}`)
                              .join(', ') || 'none'}
                          </Trust>
                        </div>
                        <p className="mt-1">{l.outbreak.reason}</p>
                        {l.reports > 0 && (
                          <p className="mt-1 text-hollow-300">
                            Avg mood {l.avgMood.toFixed(1)}/5 · avg sleep {l.avgSleep.toFixed(1)} h · {l.counts.help} asked for help
                          </p>
                        )}
                        {l.alert && l.alert.band !== 'clear' && <p className="mt-1 text-hollow-300">Power: {l.alert.reason}</p>}
                        {l.verifications.map((v) => (
                          <p key={v.id} className="mt-1">
                            <StateTag state={v.confirmed ? 'normal' : 'watch'}>
                              Warden {v.badge} {v.confirmed ? 'confirms' : 'disputes'} {v.claim}
                            </StateTag>{' '}
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
    </section>
  )
}
