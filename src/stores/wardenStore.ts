import { create } from 'zustand'
import { careCode, type CarePayload } from '../lib/care'
import type { CheckIn } from '../lib/db'
import { deriveFamilyKey, openJson } from '../lib/familyCrypto'
import type { VerifyBody } from '../lib/mesh'
import { countsFromCheckIn } from '../lib/reports'
import { demoRoster, openWardenDb, type CareEntry, type RosterEntry, type WardenDB } from '../lib/wardenDb'
import { getWorld } from '../lib/worldFeed'
import { getLedgerNode, useLedger } from './ledgerStore'

export type OnBehalf = Pick<CheckIn, 'okay' | 'mood' | 'sleepHours' | 'symptoms' | 'water'>

interface WardenState {
  level: number
  badge: string
  roster: RosterEntry[]
  care: CareEntry[]
  relayed: number
  running: boolean
  start: (level: number, deviceId: string) => Promise<void>
  stop: () => void
  checkInFor: (unit: string, c: OnBehalf) => Promise<void>
  markVisited: (unit: string) => Promise<void>
  addToRoster: (r: RosterEntry) => Promise<void>
  verify: (claim: VerifyBody['claim'], confirmed: boolean, note?: string) => void
}

let db: WardenDB | null = null
let poll: ReturnType<typeof setInterval> | null = null
let generation = 0
const tickNow = () => getWorld()?.tick ?? 0

export const useWarden = create<WardenState>((set, get) => ({
  level: 0,
  badge: '',
  roster: [],
  care: [],
  relayed: 0,
  running: false,

  start: async (level, deviceId) => {
    get().stop()
    const gen = ++generation
    db = openWardenDb(deviceId, level)
    if ((await db.roster.count()) === 0) await db.roster.bulkPut(demoRoster(level))
    const [roster, care, key] = await Promise.all([
      db.roster.toArray(),
      db.care.orderBy('tick').reverse().limit(200).toArray(),
      deriveFamilyKey(careCode(level)),
    ])
    if (gen !== generation) return
    set({ level, badge: `W-${level}-${deviceId.slice(0, 3).toUpperCase()}`, roster, care, running: true })

    useLedger.getState().start({
      nodeId: `warden-L${level}-${deviceId}`,
      level,
      onSealed: (p) => {
        const b = p.body
        if (b.kind !== 'sealed' || b.tag !== key.tag) return
        void openJson<CarePayload>(key, b.iv, b.data).then(async (msg) => {
          if (!msg || msg.type !== 'care' || msg.level !== level || !db) return
          const entry: CareEntry = { ...msg, receivedAt: Date.now() }
          entry.id = await db.care.add(entry)
          set({ care: [entry, ...get().care].slice(0, 200) })
        })
      },
    })
    poll = setInterval(() => set({ relayed: getLedgerNode()?.relayed ?? 0 }), 2000)
  },

  stop: () => {
    generation++
    if (poll) clearInterval(poll)
    poll = null
    if (get().running) useLedger.getState().stop()
    set({ running: false })
  },

  checkInFor: async (unit, c) => {
    const { level, roster } = get()
    const tick = tickNow()
    getLedgerNode()?.send(
      { kind: 'summary', level, tick, source: 'warden', counts: countsFromCheckIn(c) },
      { anonymous: true },
    )
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

  verify: (claim, confirmed, note) => {
    const { level, badge } = get()
    getLedgerNode()?.send({ kind: 'verify', level, claim, confirmed, badge, tick: tickNow(), note })
  },
}))
