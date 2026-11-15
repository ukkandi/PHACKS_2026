// Rounds records travel exactly like care notes: encrypted separately to each ACTIVE warden's key.
import type { CarePayload } from './care'
import type { MeshNode } from './mesh'
import type { RosterEntry } from './wardenDb'
import { sealTo } from './wardenCrypto'
import type { KnownWarden } from './wardenRegistry'

export interface RosterPayload {
  type: 'roster'
  level: number
  entry: RosterEntry
  /** Newer wins when the same unit arrives from several sources (0 = original rounds book). */
  updatedAt: number
}

/** Anything a warden can receive sealed to its key. */
export type WardenNote = CarePayload | RosterPayload

/** Send roster entries, each encrypted to each target warden's key. */
export async function shareRoster(node: MeshNode, level: number, entries: { entry: RosterEntry; updatedAt: number }[], targets: KnownWarden[]) {
  for (const w of targets) {
    for (const e of entries) {
      const payload: RosterPayload = { type: 'roster', level, entry: e.entry, updatedAt: e.updatedAt }
      node.send({ kind: 'care-sealed', level, to: w.fp, ...(await sealTo(w.encPub, payload)) })
    }
  }
}
