import { useEffect } from 'react'
import { Button, Card, SimTag } from '../../components/ui'
import { LEDGER_LEVEL, useLedger } from '../../stores/ledgerStore'
import { tickLabel } from '../../sim/world'
import { AllocationPanel } from './AllocationPanel'
import { HollowMap } from './HollowMap'
import { OutbreakPanel } from './OutbreakPanel'
import { useLedgerView } from './useLedgerView'
import { WellbeingPanel } from './WellbeingPanel'

export function LedgerBody({ nodeId }: { nodeId: string }) {
  const { start, stop, exportJson } = useLedger()
  const { view, bulletin, plan, tick, tally } = useLedgerView()

  useEffect(() => {
    start({ nodeId })
    return stop
  }, [start, stop, nodeId])

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `lantern-ledger-t${tick}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const held = view.levels.flatMap((l) => l.heldBack.map((h) => ({ level: l.level, ...h })))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Reports, last 12h" value={view.totalReports.toLocaleString()} />
        <Stat label="Levels reporting" value={`${view.levelsReporting} / 40`} />
        <Stat label="Outbreaks flagged" value={String(view.levels.filter((l) => l.outbreak.status === 'outbreak').length)} danger />
        <Stat label="Hollow time" value={tickLabel(tick)} />
      </div>
      {view.levelsReporting < 40 && (
        <p role="status" className="rounded-lg border border-hollow-700 p-2 text-sm text-hollow-300">
          This ledger node is still filling in: level phones report every 3 hours, so a newly joined node needs a few
          hours of Hollow time to see every level.
        </p>
      )}
      <p className="text-xs text-hollow-500">
        Anonymous counts only — no names, units or device ids ever reach the ledger. This copy is kept by a ledger node on
        Level {LEDGER_LEVEL} <SimTag>placement</SimTag>; anyone can run one and get the same numbers.{' '}
        <Button tone="ghost" className="!min-h-8 !px-2 underline" onClick={download}>
          Download raw data (JSON)
        </Button>
      </p>

      <OutbreakPanel view={view} bulletin={bulletin} />
      <AllocationPanel plan={plan} bulletin={bulletin} tally={tally} />
      <HollowMap view={view} bulletin={bulletin} />
      <div className="grid gap-4 md:grid-cols-2">
        <WellbeingPanel view={view} />
        <Card title="Held back (unverified)">
          {held.length === 0 ? (
            <p className="text-sm text-hollow-500">No suspicious reports in the last 12h.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {held.map((h) => (
                <li key={h.summary.id}>
                  <strong>L{h.level}:</strong> {h.summary.counts.reports} reports, {h.summary.counts.symptomatic} with symptoms —{' '}
                  <span className="text-warn">{h.why}</span>{' '}
                  <span className="text-hollow-500">Not counted unless a warden on L{h.level} confirms.</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-hollow-700 bg-hollow-900 p-3">
      <div className="text-xs text-hollow-500 uppercase">{label}</div>
      <div className={`text-2xl font-bold ${danger && value !== '0' ? 'text-danger' : ''}`}>{value}</div>
    </div>
  )
}
