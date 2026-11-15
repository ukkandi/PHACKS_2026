// The care channel: a sealed line from a block's residents/terminal to its wardens, used only when
// someone asks for help (or a warden checks someone in). Carries a unit number so a warden can go
// to the door — never sent to the ledger.
// SIMULATED: production would encrypt to the wardens' public keys. The demo derives a shared
// block key from the level number, which is NOT secret — fine for showing the flow, not for real use.
import type { Symptom } from './db'

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
