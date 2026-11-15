// On-device storage. Personal data lives ONLY here (principle #2: privacy by design).
import Dexie, { type EntityTable } from 'dexie'
import type { Hop } from './mesh'
import type { PubJwk } from './wardenCrypto'

export interface Profile {
  key: 'me'
  /** Stable per-device member id, used inside family-only (encrypted) messages. */
  memberId: string
  name: string
  level: number
  unit: string
  /** Shared secret for a family group. Never sent in clear over the mesh. */
  familyCode: string
  createdAt: number
}

export const SYMPTOMS = ['fever', 'cough', 'breathing', 'stomach', 'rash', 'headache'] as const
export type Symptom = (typeof SYMPTOMS)[number]
export type WaterReport = 'ok' | 'bad' | 'unsure'

export interface CheckIn {
  id?: number
  /** Simulated hour when the check-in was made. */
  tick: number
  /** Real wall-clock time. */
  ts: number
  okay: boolean
  mood: 1 | 2 | 3 | 4 | 5
  sleepHours: number
  symptoms: Symptom[]
  water: WaterReport
  level: number
}

/** Last status heard from a family member over the mesh (decrypted, on-device only). */
export interface FamilyMember {
  memberId: string
  name: string
  level: number
  unit: string
  lastCheckIn: { tick: number; okay: boolean } | null
  /** Sender's sim tick when the status was sent. */
  sentTick: number
  receivedAt: number
  route: Hop[]
}

export interface FamilyMessage {
  id: string
  memberId: string
  name: string
  level: number
  text: string
  ts: number
  tick: number
  mine: boolean
  route: Hop[]
}

/**
 * This device's own signing key, used ONLY to vouch for wardens. Not an account: it is created on
 * the device, never registered anywhere, and the private half can't be exported.
 */
export interface DeviceKey {
  id: 'me'
  signPriv: CryptoKey
  signPub: PubJwk
}

export type LanternDB = Dexie & {
  profile: EntityTable<Profile, 'key'>
  checkins: EntityTable<CheckIn, 'id'>
  family: EntityTable<FamilyMember, 'memberId'>
  messages: EntityTable<FamilyMessage, 'id'>
  keys: EntityTable<DeviceKey, 'id'>
}

const cache = new Map<string, LanternDB>()

export function openDeviceDb(deviceId: string): LanternDB {
  let db = cache.get(deviceId)
  if (db) return db
  db = new Dexie(`lantern-device-${deviceId}`) as LanternDB
  db.version(1).stores({
    profile: 'key',
    checkins: '++id, tick, ts',
  })
  db.version(2).stores({
    family: 'memberId',
    messages: 'id, ts',
  })
  db.version(3).stores({ keys: 'id' })
  cache.set(deviceId, db)
  return db
}
