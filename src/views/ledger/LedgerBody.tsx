import { useEffect } from 'react'
import { Button, Card, Explain, StateTag, Trust } from '../../components/ui'
import { useLedger } from '../../stores/ledgerStore'
import { tickLabel } from '../../sim/world'
import { AllocationPanel } from './AllocationPanel'
import { rowState } from './boardState'
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

  const states = view.levels.map((l) => rowState(l, bulletin?.levels[l.level - 1]))
  const count = (s: string) => states.filter((x) => x === s).length
  const held = view.levels.flatMap((l) => l.heldBack.map((h) => ({ level: l.level, ...h })))

  return (
    <div className="space-y-3">
      {/* Status line: readable in two seconds. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-2 border-hollow-700 bg-hollow-900 px-3 py-2">
        <StateTag state="danger" className="text-base">{count('danger')} danger</StateTag>
        <StateTag state="watch" className="text-base">{count('watch')} watch</StateTag>
        <StateTag state="normal" className="text-base">{count('normal')} normal</StateTag>
        {count('nodata') > 0 && (
          <StateTag state="nodata" className="text-base">
            {count('nodata')} no data
          </StateTag>
        )}
        <span className="font-mono text-sm text-lamp">{tickLabel(tick)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Trust tone={view.totalReports ? 'ok' : 'muted'}>Based on {view.totalReports.toLocaleString()} reports · 12 h</Trust>
        <Trust tone={view.levelsReporting < 40 ? 'warn' : 'ok'}>{view.levelsReporting} / 40 levels reporting</Trust>
        <Trust>Anonymous counts only</Trust>
        <Button tone="ghost" className="!min-h-8 !px-2 text-xs underline" onClick={download}>
          Raw data ↓
        </Button>
        <Explain label="About this ledger">
          No names, units or device ids ever reach the ledger: only per-level counts. This copy is kept by a ledger node on
          Level 20 (simulated placement); anyone can run one and get the same numbers, and the raw data can be downloaded and
          recounted.
          {view.levelsReporting < 40 && ' This node is still filling in — level phones report every 3 hours.'}
        </Explain>
      </div>

      <HollowMap view={view} bulletin={bulletin} />
      <OutbreakPanel view={view} bulletin={bulletin} />
      <AllocationPanel plan={plan} bulletin={bulletin} tally={tally} />
      <div className="grid gap-3 md:grid-cols-2">
        <WellbeingPanel view={view} />
        <Card
          title="Held back"
          help="Not counted: batches that look wrong (too many reports from one device, an unknown sender, impossible counts) until a vouched warden on that level confirms them; and anything signed by a warden key that residents haven't vouched for — those are rejected outright."
        >
          {view.rejectedVerifies.length > 0 && (
            <ul className="mb-2 space-y-1">
              {view.rejectedVerifies.map(({ verify: v, why }) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <StateTag state="danger">
                    L{v.level} · {v.badge} {v.confirmed ? 'confirms' : 'disputes'} {v.claim} · unverified warden, rejected
                  </StateTag>
                  <Explain label={`Why ${v.badge} rejected`}>
                    {why} Only confirmations signed by a warden key that residents of the level have vouched for count.
                  </Explain>
                </li>
              ))}
            </ul>
          )}
          {held.length === 0 && view.rejectedVerifies.length === 0 ? (
            <StateTag state="normal">None</StateTag>
          ) : (
            <ul className="space-y-1">
              {held.map((h) => (
                <li key={h.summary.id} className="flex items-center justify-between gap-2">
                  <StateTag state="danger">
                    {h.summary.source === 'warden'
                      ? `L${h.level} · warden check-in · ${h.summary.sigValid ? 'unverified warden' : 'unsigned'}, rejected`
                      : `L${h.level} · ${h.summary.counts.reports} reports · held, not counted`}
                  </StateTag>
                  <Explain label={`Why L${h.level} held`}>{h.why} Not counted unless a warden on L{h.level} confirms.</Explain>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
