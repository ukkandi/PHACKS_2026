// The resident device's mesh presence: family status + messages (encrypted) and public alerts.
import { create } from 'zustand'
import { AlertEmitter, alertForLevel } from '../lib/alerts'
import type { CheckIn, FamilyMember, FamilyMessage, LanternDB, Profile } from '../lib/db'
import { sendCare } from '../lib/care'
import { countsFromCheckIn } from '../lib/reports'
import { deriveFamilyKey, openJson, sealJson, type FamilyKey } from '../lib/familyCrypto'
import { MeshNode, type AlertBody, type Hop, type Link, type Packet } from '../lib/mesh'
import { getWorld, subscribeWorld } from '../lib/worldFeed'
import { isNetworkUp } from '../sim/world'

/** What goes inside an encrypted family packet. */
type FamilyPayload =
  | {
      type: 'status'
      memberId: string
      name: string
      level: number
      unit: string
      lastCheckIn: { tick: number; okay: boolean } | null
      sentTick: number
    }
  | { type: 'hello'; memberId: string }
  | { type: 'msg'; memberId: string; name: string; level: number; text: string; tick: number }

export interface ReceivedAlert extends AlertBody {
  route: Hop[]
  receivedAt: number
}

export interface Neighbour {
  nodeId: string
  level: number
  link: Link
  lastSeen: number
}

interface Ctx {
  profile: Profile
  db: LanternDB
  key: FamilyKey
  node: MeshNode
  getLastCheckIn: () => { tick: number; okay: boolean } | null
  cleanup: (() => void)[]
}

interface FamilyState {
  running: boolean
  members: Record<string, FamilyMember>
  messages: FamilyMessage[]
  alerts: Record<number, ReceivedAlert>
  neighbours: Record<string, Neighbour>
  start: (args: {
    profile: Profile
    db: LanternDB
    deviceId: string
    getLastCheckIn: () => { tick: number; okay: boolean } | null
  }) => Promise<void>
  stop: () => void
  sendStatus: () => Promise<void>
  sendMessage: (text: string) => Promise<void>
  /** Share a check-in: anonymous counts for the ledger; and, if help was asked for, a sealed note to the warden. */
  shareCheckIn: (c: CheckIn) => Promise<void>
}

let ctx: Ctx | null = null
/** Bumped by every start/stop so an older, still-awaiting start() can tell it is stale. */
let generation = 0
const HEARTBEAT_MS = 20_000

const currentTick = () => getWorld()?.tick ?? 0

async function sendFamily(c: Ctx, payload: FamilyPayload): Promise<Packet> {
  const sealed = await sealJson(c.key, payload)
  return c.node.send({ kind: 'sealed', tag: c.key.tag, ...sealed })
}

export const useFamily = create<FamilyState>((set, get) => ({
  running: false,
  members: {},
  messages: [],
  alerts: {},
  neighbours: {},

  start: async ({ profile, db, deviceId, getLastCheckIn }) => {
    get().stop()
    const gen = ++generation
    const key = await deriveFamilyKey(profile.familyCode)
    const [members, messages] = await Promise.all([db.family.toArray(), db.messages.orderBy('ts').reverse().limit(50).toArray()])
    if (gen !== generation) return
    set({ members: Object.fromEntries(members.map((m) => [m.memberId, m])), messages })

    const onDeliver = async (p: Packet) => {
      const c = ctx
      if (!c) return
      const body = p.body
      if (body.kind === 'alert') {
        if (body.level === c.profile.level) return // our own meter is authoritative for our level
        set({ alerts: { ...get().alerts, [body.level]: { ...body, route: p.path, receivedAt: Date.now() } } })
        return
      }
      if (body.kind === 'sync' && body.alerts) {
        // Catch-up: alerts that were raised before this device joined.
        const next = { ...get().alerts }
        for (const a of body.alerts) {
          if (a.level === c.profile.level) continue
          const cur = next[a.level]
          if (!cur || a.tick > cur.tick) next[a.level] = { ...a, route: p.path, receivedAt: Date.now() }
        }
        set({ alerts: next })
        return
      }
      if (body.kind !== 'sealed') return
      if (body.tag !== c.key.tag) return // someone else's family: opaque to us, but we still relayed it
      const msg = await openJson<FamilyPayload>(c.key, body.iv, body.data)
      if (!msg || msg.memberId === c.profile.memberId) return
      if (msg.type === 'hello') {
        // A family member just came online: tell them how we are (jittered to avoid collisions).
        setTimeout(() => void get().sendStatus(), 100 + Math.random() * 400)
      } else if (msg.type === 'status') {
        const m: FamilyMember = {
          memberId: msg.memberId,
          name: msg.name,
          level: msg.level,
          unit: msg.unit,
          lastCheckIn: msg.lastCheckIn,
          sentTick: msg.sentTick,
          receivedAt: Date.now(),
          route: p.path,
        }
        await c.db.family.put(m)
        set({ members: { ...get().members, [m.memberId]: m } })
      } else if (msg.type === 'msg') {
        const fm: FamilyMessage = {
          id: p.id,
          memberId: msg.memberId,
          name: msg.name,
          level: msg.level,
          text: msg.text,
          tick: msg.tick,
          ts: p.createdAt,
          mine: false,
          route: p.path,
        }
        await c.db.messages.put(fm)
        set({ messages: [fm, ...get().messages].slice(0, 50) })
      }
    }

    const node = new MeshNode({
      getInfo: () => {
        const w = getWorld()
        return { nodeId: deviceId, level: profile.level, netUp: w ? isNetworkUp(w, profile.level) : true }
      },
      onDeliver: (p) => void onDeliver(p),
      onFrame: (sender, link) => {
        const prev = get().neighbours[sender.nodeId]
        const now = Date.now()
        // Throttle: relays produce many frames; only re-render on change or every 3s per neighbour.
        if (prev && prev.link === link && now - prev.lastSeen < 3_000) return
        set({ neighbours: { ...get().neighbours, [sender.nodeId]: { nodeId: sender.nodeId, level: sender.level, link, lastSeen: now } } })
      },
    })

    const c: Ctx = { profile, db, key, node, getLastCheckIn, cleanup: [] }
    ctx = c

    // Watch our own level's meter; broadcast a public alert when the risk band changes.
    const emitter = new AlertEmitter()
    const onWorld = () => {
      const w = getWorld()
      if (!w || !ctx) return
      const a = alertForLevel(w.levels[profile.level - 1], w.tick)
      if (emitter.shouldSend(a.level, a.band)) node.send(a)
    }
    c.cleanup.push(subscribeWorld(onWorld))
    onWorld()

    const hb = setInterval(() => void get().sendStatus(), HEARTBEAT_MS)
    const prune = setInterval(() => {
      const cutoff = Date.now() - 15_000
      const n = Object.fromEntries(Object.entries(get().neighbours).filter(([, v]) => v.lastSeen > cutoff))
      set({ neighbours: n })
    }, 5_000)
    c.cleanup.push(() => clearInterval(hb), () => clearInterval(prune))

    set({ running: true })
    node.send({ kind: 'sync-req', requestId: `sync-${deviceId}-${Date.now().toString(36)}`, want: ['alerts'] })
    await sendFamily(c, { type: 'hello', memberId: profile.memberId })
    await get().sendStatus()
  },

  stop: () => {
    generation++
    if (!ctx) return
    ctx.cleanup.forEach((f) => f())
    ctx.node.close()
    ctx = null
    set({ running: false })
  },

  sendStatus: async () => {
    const c = ctx
    if (!c) return
    await sendFamily(c, {
      type: 'status',
      memberId: c.profile.memberId,
      name: c.profile.name,
      level: c.profile.level,
      unit: c.profile.unit,
      lastCheckIn: c.getLastCheckIn(),
      sentTick: currentTick(),
    })
  },

  shareCheckIn: async (checkIn) => {
    const c = ctx
    if (!c) return
    // Random delay so the anonymous summary can't be matched to this device by timing.
    setTimeout(
      () => {
        ctx?.node.send(
          { kind: 'summary', level: c.profile.level, tick: checkIn.tick, source: 'resident', counts: countsFromCheckIn(checkIn) },
          { anonymous: true },
        )
      },
      500 + Math.random() * 2500,
    )
    if (!checkIn.okay) {
      await sendCare(c.node, {
        type: 'care',
        level: c.profile.level,
        unit: c.profile.unit,
        name: c.profile.name,
        okay: false,
        symptoms: checkIn.symptoms,
        mood: checkIn.mood,
        tick: checkIn.tick,
        via: 'resident',
      })
    }
  },

  sendMessage: async (text) => {
    const c = ctx
    const clean = text.trim().slice(0, 280)
    if (!c || !clean) return
    const tick = currentTick()
    const p = await sendFamily(c, {
      type: 'msg',
      memberId: c.profile.memberId,
      name: c.profile.name,
      level: c.profile.level,
      text: clean,
      tick,
    })
    const fm: FamilyMessage = {
      id: p.id,
      memberId: c.profile.memberId,
      name: c.profile.name,
      level: c.profile.level,
      text: clean,
      tick,
      ts: p.createdAt,
      mine: true,
      route: p.path,
    }
    await c.db.messages.put(fm)
    set({ messages: [fm, ...get().messages].slice(0, 50) })
  },
}))
