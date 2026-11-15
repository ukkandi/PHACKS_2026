// Warden device storage. Rounds (names, units, notes, "vulnerable") and care notes are kept ONLY as
// records encrypted to this device's own warden key: the device decrypts them in memory with its
// non-extractable private key. Nothing about residents is stored in readable form.
import Dexie, { type EntityTable } from 'dexie'
import type { CarePayload } from './care'
import type { PubJwk, SealedToKey } from './wardenCrypto'

export interface RosterEntry {
  unit: string
  name: string
  age?: number
  note: string
  /** Elderly, on oxygen, disabled… raises triage priority. */
  vulnerable: boolean
  hasDevice: boolean
  /** Tick the warden last visited in person. */
  visitedTick?: number
}

export interface CareEntry extends CarePayload {
  id?: number | string
  receivedAt: number
}

/** This warden device's keypairs. Private keys are non-extractable CryptoKeys: they never leave the device. */
export interface WardenKeys {
  id: 'me'
  badge: string
  signPriv: CryptoKey
  signPub: PubJwk
  encPriv: CryptoKey
  encPub: PubJwk
}

/** An encrypted record (random id, so ids reveal nothing), sealed to this device's own encryption key. */
export interface VaultRecord {
  id: string
  sealed: SealedToKey
}

export type WardenDB = Dexie & {
  keys: EntityTable<WardenKeys, 'id'>
  vault: EntityTable<VaultRecord, 'id'>
}

export function openWardenDb(deviceId: string, level: number): WardenDB {
  const db = new Dexie(`lantern-warden-${deviceId}-L${level}`) as WardenDB
  db.version(1).stores({ roster: 'unit', care: '++id, unit, tick' })
  db.version(2).stores({ keys: 'id' })
  // v3: plaintext roster/care tables dropped; everything about residents lives encrypted in `vault`.
  db.version(3).stores({ roster: null, care: null, vault: 'id' })
  return db
}
