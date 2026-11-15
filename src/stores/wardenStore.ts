// A warden device. Its rounds (names, units, notes) and care notes exist only as records encrypted
// to its own warden key — received that way from the mesh, or re-encrypted to itself when the
// warden changes something — and are decrypted in memory. A device that isn't a vouched warden is
// never sent anything it can read.
import { create } from 'zustand'
import type { CheckIn } from '../lib/db'
import type { CareSealedBody, VerifyBody, WardenKeyBody } from '../lib/mesh'
import { shareRoster, type RosterPayload, type WardenNote } from '../lib/rounds'
import {
  fingerprint,
  generateEncryptionKeys,
  generateSigningKeys,
  msg,
  openFrom,
  sealTo,
  sign,
  type SealedToKey,
} from '../lib/wardenCrypto'
import { useWardenRegistry, wardenKeyPacketId, wardenStatuses } from '../lib/wardenRegistry'
import { countsFromCheckIn } from '../lib/reports'
import { openWardenDb, type CareEntry, type RosterEntry, type WardenDB, type WardenKeys } from '../lib/wardenDb'
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
let unsubRegistry: (() => void) | null = null
let generation = 0
/** When each roster unit was last changed (newer wins on merge). */
const rosterUpdatedAt = new Map<string, number>()
/** Vault record id for each unit. Ids are random, so even the stored ids reveal no unit numbers. */
const vaultIdByUnit = new Map<string, string>()
/** Other wardens of this level we've already shared our rounds with. */
const sharedWith = new Set<string>()
const tickNow = () => getWorld()?.tick ?? 0

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

/** Store a record encrypted to this device's own key. */
async function putSealed(id: string, sealed: SealedToKey) {
  await db?.vault.put({ id, sealed })
}

export const useWarden = create<WardenState>((set, get) => {
  /** Apply a decrypted note to memory (and, if `store`, keep it encrypted in the vault). */
  const applyNote = async (note: WardenNote, sealed: SealedToKey | null, vaultId?: string) => {
    if (note.type === 'roster') {
      const unit = note.entry.unit
      if (vaultId) vaultIdByUnit.set(unit, vaultId)
      const prev = rosterUpdatedAt.get(unit)
      if (prev !== undefined && prev > note.updatedAt) return
      rosterUpdatedAt.set(unit, note.updatedAt)
      set({ roster: [...get().roster.filter((r) => r.unit !== unit), note.entry] })
      if (sealed) {
        const id = vaultIdByUnit.get(unit) ?? crypto.randomUUID()
        vaultIdByUnit.set(unit, id)
        await putSealed(id, sealed)
      }
    } else if (note.type === 'care') {
      const entry: CareEntry = { ...note, id: vaultId ?? crypto.randomUUID(), receivedAt: Date.now() }
      set({ care: [entry, ...get().care].slice(0, 200) })
      if (sealed) await putSealed(String(entry.id), sealed)
    }
  }

  /** Encrypt a change to ourselves and store it, then apply it. */
  const keepLocal = async (note: WardenNote) => {
    if (!keys) return
    await applyNote(note, await sealTo(keys.encPub, note))
  }

  return {
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
      const badge = `W-${level}-${deviceId.slice(0, 3).toUpperCase()}`
      const k = await loadOrCreateKeys(db, badge)
      const fp = await fingerprint(k.signPub)
      if (gen !== generation) return
      keys = k
      rosterUpdatedAt.clear()
      vaultIdByUnit.clear()
      sharedWith.clear()
      set({ level, badge: k.badge, fp, roster: [], care: [], running: true })

      // Decrypt what this device holds — only possible with its own private key.
      for (const rec of await db.vault.toArray()) {
        const note = await openFrom<WardenNote>(k.encPriv, rec.sealed)
        if (note && note.level === level) await applyNote(note, null, rec.id)
      }
      if (gen !== generation) return

      useLedger.getState().start({
        nodeId: `warden-L${level}-${deviceId}`,
        level,
        onSealed: (p) => {
          const b = p.body
          // Only notes encrypted to THIS warden's key; everything else is unreadable anyway.
          if (b.kind !== 'care-sealed' || b.to !== fp || !keys) return
          const sealed: SealedToKey = { epk: (b as CareSealedBody).epk, iv: b.iv, data: b.data }
          void openFrom<WardenNote>(keys.encPriv, sealed).then((note) => {
            if (note && note.level === level) void applyNote(note, sealed)
          })
        },
      })

      // Announce our keys now and every 10 s so devices that join later learn them.
      const announcement = await keyAnnouncement(level, k)
      void useWardenRegistry.getState().ingest(announcement)
      const announce = () => getLedgerNode()?.send(announcement, { id: wardenKeyPacketId(fp) })
      setTimeout(announce, 300)
      announcer = setInterval(announce, 10_000)
      poll = setInterval(() => set({ relayed: getLedgerNode()?.relayed ?? 0 }), 2000)

      // When ANOTHER warden of this level becomes active (and we are), share our rounds with it —
      // encrypted to its key. That's how a newly vouched warden gets the block's rounds.
      const shareWithNewWardens = () => {
        const reg = useWardenRegistry.getState()
        const statuses = wardenStatuses(Object.values(reg.wardens), Object.values(reg.vouches))
        const meActive = statuses.some((s) => s.active && s.warden.fp === fp)
        const node = getLedgerNode()
        if (!meActive || !node) return
        const targets = statuses
          .filter((s) => s.active && s.warden.level === level && s.warden.fp !== fp && !sharedWith.has(s.warden.fp))
          .map((s) => s.warden)
        if (!targets.length) return
        targets.forEach((t) => sharedWith.add(t.fp))
        const entries = get().roster.map((entry) => ({ entry, updatedAt: rosterUpdatedAt.get(entry.unit) ?? 0 }))
        void shareRoster(node, level, entries, targets)
      }
      unsubRegistry = useWardenRegistry.subscribe(shareWithNewWardens)
    },

    stop: () => {
      generation++
      if (poll) clearInterval(poll)
      poll = null
      if (announcer) clearInterval(announcer)
      announcer = null
      unsubRegistry?.()
      unsubRegistry = null
      if (get().running) useLedger.getState().stop()
      set({ running: false, roster: [], care: [] })
    },

    checkInFor: async (unit, c) => {
      const { level, roster } = get()
      const tick = tickNow()
      const counts = countsFromCheckIn(c)
      // Signed: the ledger only counts a warden check-in from a vouched warden key.
      const core = { level, tick, source: 'warden' as const, counts }
      const wardenSig = keys ? { signPub: keys.signPub, sig: await sign(keys.signPriv, msg.summary(core)) } : undefined
      getLedgerNode()?.send({ kind: 'summary', ...core, wardenSig }, { anonymous: true })
      await keepLocal({
        type: 'care',
        level,
        unit,
        name: roster.find((r) => r.unit === unit)?.name,
        okay: c.okay,
        symptoms: c.symptoms,
        mood: c.mood,
        tick,
        via: 'warden',
      })
      // Checking someone in face to face counts as a visit.
      await get().markVisited(unit)
    },

    markVisited: async (unit) => {
      const { roster, care, level } = get()
      const existing = roster.find((r) => r.unit === unit)
      const entry: RosterEntry = existing
        ? { ...existing, visitedTick: tickNow() }
        : {
            unit,
            name: care.find((c) => c.unit === unit)?.name ?? `Unit ${unit}`,
            note: 'Added after a visit.',
            vulnerable: false,
            hasDevice: true,
            visitedTick: tickNow(),
          }
      await keepLocal({ type: 'roster', level, entry, updatedAt: Date.now() } satisfies RosterPayload)
    },

    addToRoster: async (entry) => {
      const { level, fp } = get()
      const note: RosterPayload = { type: 'roster', level, entry, updatedAt: Date.now() }
      await keepLocal(note)
      // Tell the level's other active wardens, encrypted to each of their keys.
      const node = getLedgerNode()
      const reg = useWardenRegistry.getState()
      const others = wardenStatuses(Object.values(reg.wardens), Object.values(reg.vouches))
        .filter((s) => s.active && s.warden.level === level && s.warden.fp !== fp)
        .map((s) => s.warden)
      if (node && others.length) await shareRoster(node, level, [{ entry, updatedAt: note.updatedAt }], others)
    },

    verify: async (claim, confirmed, note) => {
      const { level, badge } = get()
      if (!keys) return
      const v = { level, claim, confirmed, badge, tick: tickNow(), note }
      getLedgerNode()?.send({ kind: 'verify', ...v, signPub: keys.signPub, sig: await sign(keys.signPriv, msg.verify(v)) })
    },
  }
})
