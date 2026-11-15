// On-device storage. Personal data lives ONLY here (principle #2: privacy by design).
import Dexie, { type EntityTable } from 'dexie'

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

export type LanternDB = Dexie & {
  profile: EntityTable<Profile, 'key'>
  checkins: EntityTable<CheckIn, 'id'>
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
  cache.set(deviceId, db)
  return db
}
