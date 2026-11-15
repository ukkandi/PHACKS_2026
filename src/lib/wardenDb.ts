// Warden's device storage. Holds the block roster (people the warden looks after, many without
// devices) and care notes received over the sealed care channel. Never leaves this device.
import Dexie, { type EntityTable } from 'dexie'
import type { CarePayload } from './care'

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
  id?: number
  receivedAt: number
}

export type WardenDB = Dexie & {
  roster: EntityTable<RosterEntry, 'unit'>
  care: EntityTable<CareEntry, 'id'>
}

export function openWardenDb(deviceId: string, level: number): WardenDB {
  const db = new Dexie(`lantern-warden-${deviceId}-L${level}`) as WardenDB
  db.version(1).stores({ roster: 'unit', care: '++id, unit, tick' })
  return db
}

/** Demo roster for a fresh warden device. Unit 221 is the one used in the terminal demo. */
export function demoRoster(level: number): RosterEntry[] {
  return [
    { unit: `${level}-221`, name: 'Mrs. Okafor', age: 84, note: 'No device. On oxygen; uses the level terminal.', vulnerable: true, hasDevice: false },
    { unit: `${level}-305`, name: 'Mr. Brandt', age: 79, note: 'No device, hard of hearing. Knock loudly.', vulnerable: true, hasDevice: false },
    { unit: `${level}-117`, name: 'Dee Halvorsen', age: 41, note: 'Phone broken since the last flood.', vulnerable: false, hasDevice: false },
    { unit: `${level}-402`, name: 'The Aziz twins', age: 7, note: 'Children; parent works double shifts.', vulnerable: true, hasDevice: false },
  ]
}
