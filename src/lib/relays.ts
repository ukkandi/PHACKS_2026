// SIMULATED: "neighbour devices" — one Lantern phone per level, hosted in the World Simulator tab.
// Each relays mesh traffic, broadcasts blackout alerts for its level, and every few hours sends an
// anonymous batch of its neighbours' coarse check-in counts plus the level's public meter readings.
// Like every Lantern device they keep a small rolling log of what they've sent, so a ledger that
// joins late can be caught up. In the real Hollow these are simply other residents' phones;
// without them the demo would need thousands of tabs.
import { AlertEmitter, alertForLevel } from './alerts'
import { isResetting } from './demoReset'
import { MeshNode, type Packet, type SummaryBody } from './mesh'
import { LEVEL_COUNT, type World } from '../sim/types'
import { isNetworkUp } from '../sim/world'
import { STANDIN_EVERY, standInCounts, standInDue } from '../sim/standin'
import { simulatedBallot } from '../sim/votes'
import type { VoteBody, VouchBody } from './mesh'
import { DEMO_WARDEN_BADGE, DEMO_WARDEN_LEVEL } from './demoVouch'
import { fingerprint, generateSigningKeys, msg, sign } from './wardenCrypto'
import { feedRegistry, useWardenRegistry, vouchPacketId, wardenStatuses } from './wardenRegistry'
import { shareRoster } from './rounds'
import { demoRoster } from '../sim/demoRounds'

const LOG_KEY = 'lantern-standin-log-v1'
/** Keep this many hours of sent batches (matches the ledger's baseline window). */
const LOG_HOURS = 72

type Logged = SummaryBody & { id: string }

function loadLog(seed: number): Logged[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    const parsed = raw ? (JSON.parse(raw) as { seed: number; log: Logged[] }) : null
    return parsed && parsed.seed === seed ? parsed.log : []
  } catch {
    return []
  }
}

export interface RelayFleet {
  onWorld: (w: World) => void
  stop: () => void
}

export function startRelays(getWorld: () => World): RelayFleet {
  const emitter = new AlertEmitter()
  const answered = new Set<string>()
  let lastTick = -1
  /** Latest ballot each level phone has cast. */
  const votes = new Map<number, VoteBody>()
  let lastRound = -1
  let log: Logged[] = loadLog(getWorld().seed)
  let dirty = false

  const fed = new Set<string>()
  const onDeliver = (node: MeshNode) => (p: Packet) => {
    const b = p.body
    // All 40 phones hear the same packet; feed this tab's warden registry once.
    if (!fed.has(p.id)) {
      fed.add(p.id)
      if (fed.size > 5000) fed.clear()
      feedRegistry(b)
    }
    if (b.kind !== 'sync-req' || answered.has(b.requestId)) return
    // The first level phone to hear a catch-up request answers for the fleet.
    answered.add(b.requestId)
    const w = getWorld()
    setTimeout(() => {
      node.send({
        kind: 'sync',
        requestId: b.requestId,
        from: 'level-phones',
        summaries: b.want.includes('summaries') ? log.filter((s) => s.tick <= w.tick) : undefined,
        alerts: b.want.includes('alerts') ? w.levels.map((l) => alertForLevel(l, w.tick)) : undefined,
        votes: b.want.includes('votes') ? [...votes.values()] : undefined,
        ...(b.want.includes('wardens') ? useWardenRegistry.getState().shareable() : {}),
      })
    }, 100)
  }

  const nodes: MeshNode[] = []
  for (let level = 1; level <= LEVEL_COUNT; level++) {
    const node: MeshNode = new MeshNode({
      getInfo: () => ({ nodeId: `neighbour-L${level}`, level, netUp: isNetworkUp(getWorld(), level) }),
      onDeliver: (p) => onDeliver(node)(p),
    })
    nodes.push(node)
  }

  const sendBatch = (node: MeshNode, w: World, i: number, hours: number, id: string, tick = w.tick) => {
    const l = w.levels[i]
    const counts = standInCounts(w, l, hours)
    if (counts.reports === 0) return
    const body: SummaryBody = {
      kind: 'summary',
      level: l.level,
      tick,
      source: 'standin',
      hours,
      counts,
      conditions: { temperature: l.temperature, air: l.airQuality, powerOut: l.blackout, population: l.population },
    }
    // Deterministic id: if the simulator reloads, re-sent batches are recognised as duplicates.
    node.send(body, { anonymous: true, id })
    log.push({ ...body, id })
    dirty = true
  }
  // What each level phone already holds when the demo starts: the last 12 hours, plus the 36 hours
  // before that (dated 12h back) so every level has its own normal baseline from the first minute —
  // otherwise naturally hotter, sicker deep levels would be compared with the Hollow-wide median.
  const backfill = (w: World) =>
    nodes.forEach((node, i) => {
      sendBatch(node, w, i, 36, `standin-${w.seed}-L${i + 1}-backfill-history`, w.tick - 12)
      sendBatch(node, w, i, 12, `standin-${w.seed}-L${i + 1}-backfill`)
    })

  const onWorld = (w: World) => {
    const newHour = w.tick !== lastTick
    if (w.tick < lastTick) {
      // World was reset: forget the old world's batches and votes and start again.
      log = []
      votes.clear()
      lastRound = -1
      backfill(w)
    }
    lastTick = w.tick
    if (newHour) log = log.filter((s) => s.tick <= w.tick && w.tick - s.tick < LOG_HOURS)
    // Each level votes on the community priorities once per simulated day.
    const round = Math.floor(w.tick / 24)
    if (round !== lastRound) {
      lastRound = round
      nodes.forEach((node, i) => {
        const v: VoteBody = { kind: 'vote', ...simulatedBallot(w.seed, w.levels[i], round) }
        votes.set(v.level, v)
        node.send(v, { id: `vote-${w.seed}-L${v.level}-r${round}` })
      })
    }
    nodes.forEach((node, i) => {
      const l = w.levels[i]
      const a = alertForLevel(l, w.tick)
      if (emitter.shouldSend(a.level, a.band)) node.send(a)
      if (newHour && standInDue(w.tick, l.level)) sendBatch(node, w, i, STANDIN_EVERY, `standin-${w.seed}-L${l.level}-t${w.tick}`)
    })
  }

  const saver = setInterval(() => {
    if (!dirty || isResetting()) return
    dirty = false
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify({ seed: getWorld().seed, log }))
    } catch {
      // storage full: live relaying still works
    }
  }, 2000)

  // DEMO SETUP (src/lib/demoVouch.ts): two simulated L38 residents, each with their own device key,
  // vouch for the first W-38-WAR key they hear. Later keys claiming the same badge get nothing.
  let stopped = false
  let unsubVouch: (() => void) | null = null
  void (async () => {
    const residents = await Promise.all([generateSigningKeys(), generateSigningKeys()])
    if (stopped) return
    let vouchedFor: string | null = null
    const check = async () => {
      if (vouchedFor || stopped) return
      const first = Object.values(useWardenRegistry.getState().wardens).find(
        (w) => w.badge === DEMO_WARDEN_BADGE && w.level === DEMO_WARDEN_LEVEL,
      )
      if (!first) return
      vouchedFor = first.fp
      for (const r of residents) {
        const body: VouchBody = {
          kind: 'vouch',
          voucherLevel: DEMO_WARDEN_LEVEL,
          wardenFp: first.fp,
          voucherPub: r.publicJwk,
          sig: await sign(r.privateKey, msg.vouch(DEMO_WARDEN_LEVEL, first.fp)),
        }
        void useWardenRegistry.getState().ingest(body)
        nodes[DEMO_WARDEN_LEVEL - 1].send(body, { id: vouchPacketId(await fingerprint(r.publicJwk), first.fp) })
      }
    }
    unsubVouch = useWardenRegistry.subscribe(() => void check())
    void check()
  })()

  // DEMO SETUP (src/sim/demoRounds.ts): the level phone holds the block's existing rounds book and
  // hands it over — encrypted to the warden's key — only once that warden key is ACTIVE.
  const roundsSentTo = new Set<string>()
  const handOverRounds = () => {
    if (stopped) return
    const reg = useWardenRegistry.getState()
    for (const s of wardenStatuses(Object.values(reg.wardens), Object.values(reg.vouches))) {
      if (!s.active || roundsSentTo.has(s.warden.fp)) continue
      roundsSentTo.add(s.warden.fp)
      const lvl = s.warden.level
      void shareRoster(nodes[lvl - 1], lvl, demoRoster(lvl).map((entry) => ({ entry, updatedAt: 0 })), [s.warden])
    }
  }
  const unsubRounds = useWardenRegistry.subscribe(handOverRounds)
  handOverRounds()

  // At the start of a fresh world, each level phone shares the last 12 hours it already holds.
  const w0 = getWorld()
  if (w0.tick === 0 && !log.some((s) => s.id.endsWith('-backfill'))) backfill(w0)
  onWorld(w0)
  return {
    onWorld,
    stop: () => {
      stopped = true
      unsubVouch?.()
      unsubRounds()
      clearInterval(saver)
      nodes.forEach((n) => n.close())
    },
  }
}
