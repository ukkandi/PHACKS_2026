import { create } from 'zustand'
import type { CarePayload } from '../lib/care'
import type { CheckIn } from '../lib/db'
import type { CareSealedBody, VerifyBody, WardenKeyBody } from '../lib/mesh'
import {
  fingerprint,
  generateEncryptionKeys,
  generateSigningKeys,
  msg,
  openFrom,
  sign,
} from '../lib/wardenCrypto'
import { useWardenRegistry, wardenKeyPacketId } from '../lib/wardenRegistry'
import { countsFromCheckIn } from '../lib/reports'
import { demoRoster, openWardenDb, type CareEntry, type RosterEntry, type WardenDB, type WardenKeys } from '../lib/wardenDb'
import { getWorld } from '../lib/worldFeed'
import { getLedgerNode, useLedger } from './ledgerStore'

export type OnBehalf = Pick<CheckIn, 'okay' | 'mood' | 'sleepHours' | 'symptoms' | 'water'>

interface WardenState {
  level: number
  badge: string
  /** Fingerprint of this device's warden signing key. */
  fp: string
  roster: RosterEntry[]
  care: CareEntry[]
  relayed: number
  running: boolean
  start: (level: number, deviceId: string) => Promise<void>
  stop: () => void
  checkInFor: (unit: string, c: OnBehalf) => Promise<void>
  markVisited: (unit: string) => Promise<void>
  addToRoster: (r: RosterEntry) => Promise<void>
  verify: (claim: VerifyBody['claim'], confirmed: boolean, note?: string) => Promise<void>
}

let db: WardenDB | null = null
let keys: WardenKeys | null = null
let poll: ReturnType<typeof setInterval> | null = null
let announcer: ReturnType<typeof setInterval> | null = null

/** Load this device's warden keys, generating them on first use. */
async function loadOrCreateKeys(d: WardenDB, badge: string): Promise<WardenKeys> {
  const existing = await d.keys.get('me')
  if (existing) return existing
  const [s, e] = await Promise.all([generateSigningKeys(), generateEncryptionKeys()])
  const k: WardenKeys = { id: 'me', badge, signPriv: s.privateKey, signPub: s.publicJwk, encPriv: e.privateKey, encPub: e.publicJwk }
  await d.keys.put(k)
  return k
}

/** Self-signed announcement of this warden's public keys. */
async function keyAnnouncement(level: number, k: WardenKeys): Promise<WardenKeyBody> {
  const sig = await sign(k.signPriv, msg.wardenKey(level, k.badge, await fingerprint(k.signPub), await fingerprint(k.encPub)))
  return { kind: 'warden-key', level, badge: k.badge, signPub: k.signPub, encPub: k.encPub, sig }
}
let generation = 0
const tickNow = () => getWorld()?.tick ?? 0

export const useWarden = create<WardenState>((set, get) => ({
  level: 0,
  badge: '',
  fp: '',
  roster: [],
  care: [],
  relayed: 0,
  running: false,

  start: async (level, deviceId) => {
    get().stop()
    const gen = ++generation
    db = openWardenDb(deviceId, level)
    if ((await db.roster.count()) === 0) await db.roster.bulkPut(demoRoster(level))
    const badge = `W-${level}-${deviceId.slice(0, 3).toUpperCase()}`
    const [roster, care, k] = await Promise.all([
      db.roster.toArray(),
      db.care.orderBy('tick').reverse().limit(200).toArray(),
      loadOrCreateKeys(db, badge),
    ])
    const fp = await fingerprint(k.signPub)
    if (gen !== generation) return
    keys = k
    set({ level, badge: k.badge, fp, roster, care, running: true })

    useLedger.getState().start({
      nodeId: `warden-L${level}-${deviceId}`,
      level,
      onSealed: (p) => {
        const b = p.body
        // Only notes encrypted to THIS warden's key; everything else is unreadable anyway.
        if (b.kind !== 'care-sealed' || b.to !== fp || !keys) return
        void openFrom<CarePayload>(keys.encPriv, b as CareSealedBody).then(async (note) => {
          if (!note || note.type !== 'care' || note.level !== level || !db) return
          const entry: CareEntry = { ...note, receivedAt: Date.now() }
          entry.id = await db.care.add(entry)
          set({ care: [entry, ...get().care].slice(0, 200) })
        })
      },
    })

    // Announce our keys now and every 10 s so devices that join later learn them (same packet id,
    // so devices that already have it ignore the repeat).
    const announcement = await keyAnnouncement(level, k)
    void useWardenRegistry.getState().ingest(announcement)
    const announce = () => getLedgerNode()?.send(announcement, { id: wardenKeyPacketId(fp) })
    setTimeout(announce, 300)
    announcer = setInterval(announce, 10_000)
    poll = setInterval(() => set({ relayed: getLedgerNode()?.relayed ?? 0 }), 2000)
  },

  stop: () => {
    generation++
    if (poll) clearInterval(poll)
    poll = null
    if (announcer) clearInterval(announcer)
    announcer = null
    if (get().running) useLedger.getState().stop()
    set({ running: false })
  },

  checkInFor: async (unit, c) => {
    const { level, roster } = get()
    const tick = tickNow()
    const counts = countsFromCheckIn(c)
    // Signed: the ledger only counts a warden check-in from a vouched warden key.
    const core = { level, tick, source: 'warden' as const, counts }
    const wardenSig = keys ? { signPub: keys.signPub, sig: await sign(keys.signPriv, msg.summary(core)) } : undefined
    getLedgerNode()?.send({ kind: 'summary', ...core, wardenSig }, { anonymous: true })
    const entry: CareEntry = {
      type: 'care',
      level,
      unit,
      name: roster.find((r) => r.unit === unit)?.name,
      okay: c.okay,
      symptoms: c.symptoms,
      mood: c.mood,
      tick,
      via: 'warden',
      receivedAt: Date.now(),
    }
    if (db) entry.id = await db.care.add(entry)
    set({ care: [entry, ...get().care] })
    // Checking someone in face to face counts as a visit.
    await get().markVisited(unit)
  },

  markVisited: async (unit) => {
    const roster = get().roster
    const existing = roster.find((r) => r.unit === unit)
    const updated: RosterEntry = existing
      ? { ...existing, visitedTick: tickNow() }
      : { unit, name: get().care.find((c) => c.unit === unit)?.name ?? `Unit ${unit}`, note: 'Added after a visit.', vulnerable: false, hasDevice: true, visitedTick: tickNow() }
    await db?.roster.put(updated)
    set({ roster: existing ? roster.map((r) => (r.unit === unit ? updated : r)) : [...roster, updated] })
  },

  addToRoster: async (r) => {
    await db?.roster.put(r)
    set({ roster: [...get().roster.filter((x) => x.unit !== r.unit), r] })
  },

  verify: async (claim, confirmed, note) => {
    const { level, badge } = get()
    if (!keys) return
    const v = { level, claim, confirmed, badge, tick: tickNow(), note }
    getLedgerNode()?.send({ kind: 'verify', ...v, signPub: keys.signPub, sig: await sign(keys.signPriv, msg.verify(v)) })
  },
}))
