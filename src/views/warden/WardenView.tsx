import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { Button, Card, Explain, Sign, StateTag, Trust } from '../../components/ui'
import type { State } from '../../lib/status'
import { MIN_REPORTS } from '../../lib/outbreak'
import { shortFp } from '../../lib/wardenCrypto'
import { useWardenRegistry, VOUCHES_REQUIRED, wardenStatuses } from '../../lib/wardenRegistry'

/** This warden device's standing in its own registry: vouched by residents of its level, or not yet. */
function useMyStatus() {
  const fp = useWarden((s) => s.fp)
  const wardens = useWardenRegistry((s) => s.wardens)
  const vouches = useWardenRegistry((s) => s.vouches)
  const st = wardenStatuses(Object.values(wardens), Object.values(vouches)).find((x) => x.warden.fp === fp)
  return { fp, active: !!st?.active, same: st?.sameLevel ?? 0, other: st?.otherLevel ?? 0 }
}
import { getDeviceId } from '../../lib/device'
import { triage, type TriageRow } from '../../lib/triage'
import { useWorld } from '../../lib/worldFeed'
import { useWarden } from '../../stores/wardenStore'
import { LEVEL_COUNT } from '../../sim/types'
import { isNetworkUp, tickLabel } from '../../sim/world'
import { useLedgerView } from '../ledger/useLedgerView'
import { WarningBanner } from '../resident/WarningBanner'
import { OnBehalfForm } from './OnBehalfForm'

const STATUS: Record<TriageRow['status'], { label: string; state: State }> = {
  'needs-help': { label: 'Needs help', state: 'danger' },
  unwell: { label: 'Unwell', state: 'watch' },
  missing: { label: 'No check-in', state: 'watch' },
  okay: { label: 'Okay', state: 'normal' },
}

export function WardenView() {
  const [params, setParams] = useSearchParams()
  const level = Number(params.get('level'))
  const valid = level >= 1 && level <= LEVEL_COUNT
  if (!valid) {
    return (
      <Shell view="warden">
        <div className="mb-3">
          <Sign sub="Which block do you look after?">Select level</Sign>
        </div>
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
  const me = useMyStatus()
  const [open, setOpen] = useState<string | null>(null)
  const tick = world?.tick ?? 0
  const rows = useMemo(() => triage(roster, care, tick), [roster, care, tick])

  useEffect(() => {
    void start(level, getDeviceId())
    document.title = `Warden · Level ${level} — Lantern`
    return stop
  }, [level, start, stop])

  const net = world ? isNetworkUp(world, level) : true

  // Not vouched (yet): a locked screen. No names, units, rounds, care notes or ledger actions —
  // and none of that data exists on this device anyway: it's only ever sent encrypted to active wardens.
  if (!me.active) return <LockedWarden level={level} badge={badge} fp={me.fp} same={me.same} other={me.other} running={running} />

  const urgent = rows.filter((r) => r.status === 'needs-help').length
  const watch = rows.filter((r) => r.status === 'unwell' || r.status === 'missing').length

  return (
    <Shell
      view={`warden · L${level}`}
      aside={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Trust tone={net ? 'ok' : 'warn'}>{net ? 'Network: normal' : "Network down · through neighbors' phones"}</Trust>
          <Trust>Passed along {relayed} for others</Trust>
          {world && <span className="font-mono text-xs text-lamp">{tickLabel(world.tick)}</span>}
        </div>
      }
    >
      <div className="space-y-3">
        <Sign sub={`Warden ${badge || '…'} · key ${me.fp ? shortFp(me.fp) : '…'}`}>Level {level} · warden</Sign>
        <div className={`flex flex-wrap items-center justify-between gap-2 border-2 px-3 py-2 ${me.active ? 'border-ok' : 'border-warn'}`}>
          <StateTag state={me.active ? 'normal' : 'watch'} className="text-base">
            {me.active ? `Active · vouched by ${me.same} of L${level}` : `Not active · ${me.same}/${VOUCHES_REQUIRED} vouches`}
          </StateTag>
          {me.other > 0 && <Trust tone="muted">+{me.other} other level, not counted</Trust>}
          <Explain label="How warden activation works">
            This device made its own keypair; the private key never leaves it. It becomes an active warden once{' '}
            {VOUCHES_REQUIRED} residents of Level {level} vouch for its public key from their own devices (in person: they
            check the key shown here). Every confirmation and check-in it sends is signed; the public board and residents ignore
            anything unsigned or from a key that isn't vouched. Care notes are encrypted to vouched wardens' keys only.
          </Explain>
        </div>
        <WarningBanner world={world} level={level} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-2 border-hollow-700 bg-hollow-900 px-3 py-2">
          <StateTag state="danger" className="text-base">{urgent} need help</StateTag>
          <StateTag state="watch" className="text-base">{watch} to check</StateTag>
          <Trust>Notes for you: only you can read</Trust>
        </div>
        <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
          <Card
            title="Visit first"
            help="Ranked by: asked for help, breathing trouble, fever, very low mood, vulnerable (elderly, oxygen, children), and nobody checking in for a day. Notes come privately from terminals and phones on your block; only trusted warden phones can read them."
          >
            {!running && <p className="font-mono text-xs uppercase">Opening…</p>}
            <ul className="divide-y-2 divide-hollow-800">
              {rows.map((r) => {
                const st = STATUS[r.status]
                return (
                  <li key={r.unit} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold uppercase">
                        {r.name} <span className="font-normal text-hollow-500">· {r.unit}</span>
                        {r.roster?.age !== undefined && <span className="font-normal text-hollow-500"> · {r.roster.age}</span>}
                      </span>
                      <StateTag state={st.state} className="text-sm">
                        {st.label}
                      </StateTag>
                    </div>
                    {r.reasons.length > 0 && (
                      <div className="mt-0.5 font-mono text-xs font-bold tracking-wider text-warn uppercase">{r.reasons.join(' · ')}</div>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4">
                      <Trust tone={r.last ? 'ok' : 'warn'}>
                        {r.last ? `Last ${tickLabel(r.last.tick)} via ${r.last.via}` : 'No check-in received'}
                      </Trust>
                      {r.roster && !r.roster.hasDevice && <Trust tone="muted">No device</Trust>}
                      {r.roster?.visitedTick !== undefined && <Trust>Visited {tickLabel(r.roster.visitedTick)}</Trust>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button className="min-h-12" disabled={!me.active} onClick={() => setOpen(open === r.unit ? null : r.unit)}>
                        Check in
                      </Button>
                      <Button className="min-h-12" tone="ghost" onClick={() => void markVisited(r.unit)}>
                        Visited
                      </Button>
                      {r.roster?.note && <Explain label={`Note on ${r.name}`}>{r.roster.note}</Explain>}
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
          <div className="space-y-3">
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
  const { view } = useLedgerView()
  const l = view.levels[level - 1]
  const [sent, setSent] = useState<string | null>(null)
  const act = (claim: 'outbreak' | 'water' | 'reports', confirmed: boolean, note: string) => {
    void verify(claim, confirmed, note)
    setSent(`${confirmed ? 'Confirmed' : 'Disputed'} ${claim} · L${level}`)
  }
  const o = l.outbreak.status
  // Nothing to vouch for until the level has enough reports to flag something.
  const enough = l.reports >= MIN_REPORTS
  const me = useMyStatus()
  return (
    <Card
      title={`Check public board · L${level}`}
      help="What the public board shows for your block. Vouch for it — or dispute it — from what you see on your rounds. The public board shows your warden badge next to the figure."
    >
      <ul className="space-y-3">
        <li>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {enough ? (
              <StateTag state={o === 'outbreak' ? 'danger' : o === 'watch' ? 'watch' : 'normal'}>
                Illness {(l.outbreak.rate * 100).toFixed(1)}% · {o}
              </StateTag>
            ) : (
              <StateTag state="nodata">Illness · not enough data</StateTag>
            )}
            <Trust tone={enough ? 'ok' : 'muted'}>{l.reports} reports</Trust>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button className="min-h-12" disabled={!enough || !me.active} onClick={() => act('outbreak', true, 'Seen many sick neighbours on rounds.')}>
              Confirm outbreak
            </Button>
            <Button
              className="min-h-12"
              tone="ghost"
              disabled={!enough || !me.active}
              onClick={() => act('outbreak', false, 'Not seeing illness on rounds.')}
            >
              Dispute
            </Button>
          </div>
        </li>
        <li>
          {enough ? (
            <StateTag state={l.waterBadShare >= 0.2 ? 'danger' : l.waterBadShare >= 0.1 ? 'watch' : 'normal'}>
              Bad water {Math.round(l.waterBadShare * 100)}%
            </StateTag>
          ) : (
            <StateTag state="nodata">Water · not enough data</StateTag>
          )}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button className="min-h-12" disabled={!enough || !me.active} onClick={() => act('water', true, 'Tap water discoloured on this block.')}>
              Confirm water
            </Button>
            <Button
              className="min-h-12"
              tone="ghost"
              disabled={!enough || !me.active}
              onClick={() => act('water', false, 'Water looks and smells fine.')}
            >
              Dispute
            </Button>
          </div>
        </li>
        {l.heldBack.length > 0 && (
          <li className="border-2 border-danger p-2">
            <div className="flex items-center justify-between gap-2">
              <StateTag state="danger">{l.heldBack.length} batch held</StateTag>
              <Explain label="Why held">{l.heldBack[0].why}</Explain>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Button className="min-h-12" disabled={!me.active} onClick={() => act('reports', true, 'Checked: these reports are real.')}>
                Count them
              </Button>
              <Button
                className="min-h-12"
                tone="danger"
                disabled={!me.active}
                onClick={() => act('reports', false, 'Not real: nobody here reported this.')}
              >
                Mark fake
              </Button>
            </div>
          </li>
        )}
      </ul>
      {sent && (
        <p role="status" className="mt-3">
          <StateTag state="normal">Sent · {sent}</StateTag>
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
  const input = 'min-h-12 w-full border-2 border-hollow-700 bg-hollow-950 px-3 font-mono'
  return (
    <Card title="Add to rounds" right={<Trust>This device only</Trust>}>
      <form onSubmit={submit} className="space-y-2">
        <label className="block text-xs uppercase">
          Name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-xs uppercase">
          Unit ({level}-…)
          <input className={input} value={unit} inputMode="numeric" onChange={(e) => setUnit(e.target.value)} />
        </label>
        <label className="block text-xs uppercase">
          Note
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-xs uppercase">
          <input type="checkbox" className="size-5 accent-lamp" checked={vulnerable} onChange={(e) => setVulnerable(e.target.checked)} />
          Vulnerable
        </label>
        <Button type="submit" tone="primary" className="min-h-12 w-full">
          Add
        </Button>
      </form>
    </Card>
  )
}

function LockedWarden({
  level,
  badge,
  fp,
  same,
  other,
  running,
}: {
  level: number
  badge: string
  fp: string
  same: number
  other: number
  running: boolean
}) {
  return (
    <Shell view={`warden · L${level}`} aside={<Trust tone="warn">Locked</Trust>}>
      <div className="mx-auto max-w-xl space-y-3">
        <Sign sub={badge ? `Warden ${badge} · this device` : 'Warden · this device'}>Level {level} · warden</Sign>
        <section aria-label="Warden status" className="border-2 border-warn">
          <div className="px-3 py-3">
            <StateTag state="watch" className="text-2xl">
              {running ? `Not active · ${same}/${VOUCHES_REQUIRED} vouches` : 'Starting…'}
            </StateTag>
            {other > 0 && (
              <div className="mt-1">
                <Trust tone="muted">+{other} other level, not counted</Trust>
              </div>
            )}
          </div>
        </section>
        <section aria-label="This device's warden key" className="border-2 border-hollow-700 bg-black px-3 py-4 text-center">
          <div className="font-mono text-sm tracking-[0.15em] text-hollow-300 uppercase">Warden key</div>
          <div className="font-mono text-5xl font-bold tracking-[0.12em] text-lamp">{fp ? shortFp(fp) : '····'}</div>
          <div className="mt-1 font-mono text-sm tracking-wider text-hollow-300 uppercase">Neighbours check this in person</div>
        </section>
        <section aria-label="How to activate" className="border-2 border-hollow-700 bg-hollow-900 p-3">
          <h2 className="font-mono text-sm font-bold tracking-[0.12em] text-lamp uppercase">To activate</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-base">
            <li>Ask {VOUCHES_REQUIRED} residents of Level {level} to vouch for you.</li>
            <li>
              On their phone: <b>Wardens · L{level}</b> → check the key matches <b className="font-mono">{fp ? shortFp(fp) : '…'}</b> →{' '}
              <b>Vouch</b>.
            </li>
            <li>This screen unlocks when {VOUCHES_REQUIRED} have vouched.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Trust>Rounds sent only to active wardens</Trust>
            <Trust>Locked to warden keys</Trust>
          </div>
        </section>
      </div>
    </Shell>
  )
}
