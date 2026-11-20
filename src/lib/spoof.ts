// SIMULATED ATTACK, for the trust demo: a single rogue device floods a level with fake symptom
// reports (e.g. to trigger a panic, or to discredit the ledger). The ledger should hold it back.
import { MeshNode } from './mesh'
import { ZERO_COUNTS } from './reports'
import { generateSigningKeys, msg, sign } from './wardenCrypto'

export function injectFakeReports(level: number, tick: number, netUp: boolean) {
  const node = new MeshNode({ getInfo: () => ({ nodeId: `rogue-${Math.random().toString(36).slice(2, 6)}`, level, netUp }), relay: false })
  const n = 300
  node.send({
    kind: 'summary',
    level,
    tick,
    source: 'unknown',
    counts: { ...ZERO_COUNTS, reports: n, okay: n, symptomatic: 290, fever: 290, moodSum: n * 3, sleepSum: n * 7 },
  })
  setTimeout(() => node.close(), 1000)
}

/**
 * SIMULATED ATTACK: an impostor poses as the L38 warden to DENY the outbreak. It has a real keypair
 * and a perfectly valid signature — but nobody on the level has vouched for its key, so every
 * Lantern device that checks (the ledger, residents) rejects the dispute; the outbreak stays confirmed.
 */
export async function injectImpostorDispute(level: number, tick: number, netUp: boolean) {
  const keys = await generateSigningKeys()
  const v = { level, claim: 'outbreak' as const, confirmed: false, badge: `W-${level}-WAR`, tick, note: 'I am the warden. There is no outbreak.' }
  const node = new MeshNode({ getInfo: () => ({ nodeId: `impostor-${Math.random().toString(36).slice(2, 6)}`, level, netUp }), relay: false })
  node.send({ kind: 'verify', ...v, signPub: keys.publicJwk, sig: await sign(keys.privateKey, msg.verify(v)) })
  setTimeout(() => node.close(), 1000)
}
