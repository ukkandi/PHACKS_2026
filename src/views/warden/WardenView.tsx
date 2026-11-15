import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { Badge, Button, Card, type BadgeTone } from '../../components/ui'
import { DEFAULT_PRIORITIES } from '../../lib/allocation'
import { getDeviceId } from '../../lib/device'
import { triage, type TriageRow } from '../../lib/triage'
import { useWorld } from '../../lib/worldFeed'
import { useWarden } from '../../stores/wardenStore'
import { LEVEL_COUNT } from '../../sim/types'
import { isNetworkUp, tickLabel } from '../../sim/world'
import { useLedgerView } from '../ledger/useLedgerView'
import { WarningBanner } from '../resident/WarningBanner'
import { OnBehalfForm } from './OnBehalfForm'

const STATUS: Record<TriageRow['status'], { label: string; tone: BadgeTone }> = {
  'needs-help': { label: 'Needs help', tone: 'danger' },
  unwell: { label: 'Unwell', tone: 'warn' },
  missing: { label: 'Not checked in', tone: 'warn' },
  okay: { label: 'Okay', tone: 'ok' },
}

export function WardenView() {
  const [params, setParams] = useSearchParams()
  const level = Number(params.get('level'))
  const valid = level >= 1 && level <= LEVEL_COUNT
  if (!valid) {
    return (
      <Shell view="warden">
        <h1 className="mb-4 text-2xl font-bold">Which level's block do you look after?</h1>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
          {Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map((n) => (
            <Button key={n} className="min-h-14 text-lg" onClick={() => setParams({ level: String(n) })}>
              {n}
            </Button>
          ))}
        </div>
      </Shell>
    )
  }
  return <Warden level={level} />
}

function Warden({ level }: { level: number }) {
  const world = useWorld()
  const { start, stop, badge, roster, care, relayed, checkInFor, markVisited, running } = useWarden()
  const [open, setOpen] = useState<string | null>(null)
  const tick = world?.tick ?? 0
  const rows = useMemo(() => triage(roster, care, tick), [roster, care, tick])

  useEffect(() => {
    void start(level, getDeviceId())
    document.title = `Warden · Level ${level} — Lantern`
    return stop
  }, [level, start, stop])

  const net = world ? isNetworkUp(world, level) : true

  return (
    <Shell
      view={`warden · Level ${level}`}
      aside={
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="lamp">Warden {badge || '…'}</Badge>
          <Badge tone={net ? 'ok' : 'warn'}>{net ? 'Directorate net + mesh' : 'Mesh only'}</Badge>
          <span className="text-xs text-hollow-500">relayed {relayed} packets for others</span>
          {world && <span className="font-mono text-xs text-lamp">{tickLabel(world.tick)}</span>}
        </div>
      }
    >
      <div className="space-y-4">
        <WarningBanner world={world} level={level} />
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Card title="Who to visit first" right={<span className="text-xs text-hollow-500">care triage · sealed to wardens</span>}>
            {!running && <p className="text-sm text-hollow-500">Opening…</p>}
            <ul className="divide-y divide-hollow-800">
              {rows.map((r) => {
                const st = STATUS[r.status]
                return (
                  <li key={r.unit} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong>{r.name}</strong> <span className="text-hollow-500">· {r.unit}</span>
                        {r.roster?.age !== undefined && <span className="text-hollow-500"> · {r.roster.age}</span>}
                        {r.roster && !r.roster.hasDevice && <span className="text-hollow-500"> · no device</span>}
                      </div>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    {r.reasons.length > 0 && <div className="mt-1 text-sm text-warn">{r.reasons.join(' · ')}</div>}
                    <div className="mt-1 text-xs text-hollow-500">
                      {r.last ? `Last check-in ${tickLabel(r.last.tick)} via ${r.last.via}` : 'No check-in received'}
                      {r.roster?.visitedTick !== undefined && ` · visited ${tickLabel(r.roster.visitedTick)}`}
                      {r.roster?.note && ` · ${r.roster.note}`}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button onClick={() => setOpen(open === r.unit ? null : r.unit)}>Check in for them</Button>
                      <Button tone="ghost" onClick={() => void markVisited(r.unit)}>
                        Mark visited
                      </Button>
                    </div>
                    {open === r.unit && (
                      <OnBehalfForm
                        name={r.name}
                        onCancel={() => setOpen(null)}
                        onSubmit={(c) => {
                          void checkInFor(r.unit, c)
                          setOpen(null)
                        }}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
          <div className="space-y-4">
            <VerifyCard level={level} />
            <AddPersonCard level={level} />
          </div>
        </div>
      </div>
    </Shell>
  )
}

function VerifyCard({ level }: { level: number }) {
  const verify = useWarden((s) => s.verify)
  const { view } = useLedgerView(DEFAULT_PRIORITIES)
  const l = view.levels[level - 1]
  const [sent, setSent] = useState<string | null>(null)
  const act = (claim: 'outbreak' | 'water' | 'reports', confirmed: boolean, note: string) => {
    verify(claim, confirmed, note)
    setSent(`${confirmed ? 'Confirmed' : 'Disputed'} ${claim} on Level ${level}. The ledger will show your badge.`)
  }
  return (
    <Card title={`Verify the ledger · Level ${level}`}>
      <p className="mb-3 text-sm text-hollow-300">
        What the public ledger currently shows for your block. Vouch for it — or dispute it — from what you see on your
        rounds.
      </p>
      <ul className="space-y-3 text-sm">
        <li>
          <div>
            Symptoms: <strong>{(l.outbreak.rate * 100).toFixed(1)}%</strong> of {l.reports} reports —{' '}
            <Badge tone={l.outbreak.status === 'outbreak' ? 'danger' : l.outbreak.status === 'watch' ? 'warn' : 'muted'}>
              {l.outbreak.status}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button onClick={() => act('outbreak', true, 'Seen many sick neighbours on rounds.')}>Confirm outbreak</Button>
            <Button tone="ghost" onClick={() => act('outbreak', false, 'Not seeing illness on rounds.')}>
              Dispute
            </Button>
          </div>
        </li>
        <li>
          <div>
            Bad water: <strong>{Math.round(l.waterBadShare * 100)}%</strong> of reports
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button onClick={() => act('water', true, 'Tap water discoloured on this block.')}>Confirm water problem</Button>
            <Button tone="ghost" onClick={() => act('water', false, 'Water looks and smells fine.')}>
              Dispute
            </Button>
          </div>
        </li>
        {l.heldBack.length > 0 && (
          <li className="rounded-lg border border-warn/50 p-2">
            <div className="text-warn">
              {l.heldBack.length} suspicious batch{l.heldBack.length > 1 ? 'es' : ''} held back: {l.heldBack[0].why}
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button onClick={() => act('reports', true, 'Checked: these reports are real.')}>They're real — count them</Button>
              <Button tone="danger" onClick={() => act('reports', false, 'Not real: nobody here reported this.')}>
                Mark as fake
              </Button>
            </div>
          </li>
        )}
      </ul>
      {sent && (
        <p role="status" className="mt-3 text-sm text-ok">
          {sent}
        </p>
      )}
    </Card>
  )
}

function AddPersonCard({ level }: { level: number }) {
  const addToRoster = useWarden((s) => s.addToRoster)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [note, setNote] = useState('')
  const [vulnerable, setVulnerable] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !unit.trim()) return
    void addToRoster({ unit: `${level}-${unit.trim()}`, name: name.trim(), note: note.trim(), vulnerable, hasDevice: false })
    setName('')
    setUnit('')
    setNote('')
    setVulnerable(false)
  }
  const input = 'min-h-11 w-full rounded-lg border border-hollow-700 bg-hollow-800 px-3'
  return (
    <Card title="Add someone to your rounds">
      <form onSubmit={submit} className="space-y-2 text-sm">
        <label className="block">
          Name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          Unit ({level}-…)
          <input className={input} value={unit} inputMode="numeric" onChange={(e) => setUnit(e.target.value)} />
        </label>
        <label className="block">
          Note
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="size-5 accent-amber-400" checked={vulnerable} onChange={(e) => setVulnerable(e.target.checked)} />
          Vulnerable (elderly, oxygen, children…)
        </label>
        <Button type="submit" tone="primary">
          Add
        </Button>
        <p className="text-xs text-hollow-500">Kept only on this warden device.</p>
      </form>
    </Card>
  )
}
