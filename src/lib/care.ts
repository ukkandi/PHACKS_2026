// The care channel: a note from a resident's phone (only when they ask for help) or a level
// terminal to the block's wardens. It carries a unit number so a warden can go to the door, and it
// is never sent to the ledger.
// Each note is encrypted separately to the public key of every ACTIVE warden of that level — i.e.
// every warden key this device has seen vouched for by 3 residents of the level. Nobody else,
// including other wardens, relays or the Directorate, can read it.
import type { Symptom } from './db'
import type { MeshNode } from './mesh'
import { sealTo } from './wardenCrypto'
import { useWardenRegistry } from './wardenRegistry'

export interface CarePayload {
  type: 'care'
  level: number
  unit: string
  /** Optional: residents may give a name; terminals don't. */
  name?: string
  okay: boolean
  symptoms: Symptom[]
  mood: number
  tick: number
  via: 'resident' | 'terminal' | 'warden'
}

/** Seal a care note to every active warden of its level. Returns how many wardens it was sent to. */
export async function sendCareToWardens(node: MeshNode, payload: CarePayload): Promise<number> {
  const wardens = useWardenRegistry
    .getState()
    .statuses()
    .filter((s) => s.active && s.warden.level === payload.level)
  for (const s of wardens) {
    const sealed = await sealTo(s.warden.encPub, payload)
    node.send({ kind: 'care-sealed', level: payload.level, to: s.warden.fp, ...sealed })
  }
  return wardens.length
}

/** How many active wardens this device knows for a level (for honest UI before sending). */
export function activeWardenCount(level: number): number {
  return useWardenRegistry
    .getState()
    .statuses()
    .filter((s) => s.active && s.warden.level === level).length
}
