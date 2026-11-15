// The care channel: a sealed line from a block's residents/terminal to its wardens, used only when
// someone asks for help (or a warden checks someone in). Carries a unit number so a warden can go
// to the door — never sent to the ledger.
// SIMULATED: production would encrypt to the wardens' public keys. The demo derives a shared
// block key from the level number, which is NOT secret — fine for showing the flow, not for real use.
import type { Symptom } from './db'
import { deriveFamilyKey, sealJson } from './familyCrypto'
import type { MeshNode } from './mesh'

export function careCode(level: number): string {
  return `CARE-BLOCK-L${level}`
}

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

/** Seal a care note to the block's wardens and send it over the mesh. */
export async function sendCare(node: MeshNode, payload: CarePayload): Promise<void> {
  const key = await deriveFamilyKey(careCode(payload.level))
  const sealed = await sealJson(key, payload)
  node.send({ kind: 'sealed', tag: key.tag, ...sealed })
}
