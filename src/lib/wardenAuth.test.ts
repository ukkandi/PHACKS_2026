import { describe, expect, it } from 'vitest'
import type { VouchBody, WardenKeyBody } from './mesh'
import {
  fingerprint,
  generateEncryptionKeys,
  generateSigningKeys,
  msg,
  openFrom,
  sealTo,
  sign,
  verifySig,
} from './wardenCrypto'
import { checkVouch, checkWardenKey, isActiveWarden, wardenStatuses, type KnownVouch } from './wardenRegistry'

async function makeWarden(level: number, badge = 'W-38-WAR') {
  const s = await generateSigningKeys()
  const e = await generateEncryptionKeys()
  const fp = await fingerprint(s.publicJwk)
  const body: WardenKeyBody = {
    kind: 'warden-key',
    level,
    badge,
    signPub: s.publicJwk,
    encPub: e.publicJwk,
    sig: await sign(s.privateKey, msg.wardenKey(level, badge, fp, await fingerprint(e.publicJwk))),
  }
  return { s, e, fp, body }
}

async function vouchFor(wardenFp: string, voucherLevel: number): Promise<VouchBody> {
  const r = await generateSigningKeys()
  return { kind: 'vouch', voucherLevel, wardenFp, voucherPub: r.publicJwk, sig: await sign(r.privateKey, msg.vouch(voucherLevel, wardenFp)) }
}

describe('warden crypto', () => {
  it('signs and verifies; rejects tampering and other keys', async () => {
    const a = await generateSigningKeys()
    const b = await generateSigningKeys()
    const sig = await sign(a.privateKey, 'hello')
    expect(await verifySig(a.publicJwk, 'hello', sig)).toBe(true)
    expect(await verifySig(a.publicJwk, 'hellO', sig)).toBe(false)
    expect(await verifySig(b.publicJwk, 'hello', sig)).toBe(false)
    expect(await verifySig(a.publicJwk, 'hello', undefined)).toBe(false)
  })

  it('seals a note that only the recipient warden can open', async () => {
    const w = await generateEncryptionKeys()
    const other = await generateEncryptionKeys()
    const sealed = await sealTo(w.publicJwk, { unit: '38-221', help: true })
    expect(await openFrom(w.privateKey, sealed)).toEqual({ unit: '38-221', help: true })
    expect(await openFrom(other.privateKey, sealed)).toBeNull()
  })

  it('canonical summary message ignores key order', () => {
    const a = msg.summary({ level: 1, tick: 2, source: 'warden', counts: { b: 1, a: 2 } })
    const b = msg.summary({ level: 1, tick: 2, source: 'warden', counts: { a: 2, b: 1 } })
    expect(a).toBe(b)
  })
})

describe('community vouching', () => {
  it('a warden key with a forged self-signature is ignored', async () => {
    const w = await makeWarden(38)
    expect(await checkWardenKey(w.body)).not.toBeNull()
    expect(await checkWardenKey({ ...w.body, badge: 'W-38-BOSS' })).toBeNull()
  })

  it('becomes active only with 3 vouches from its own level', async () => {
    const w = await makeWarden(38)
    const known = (await checkWardenKey(w.body))!
    const vs: KnownVouch[] = []
    for (const lvl of [38, 38, 36]) vs.push((await checkVouch(await vouchFor(w.fp, lvl)))!)
    let st = wardenStatuses([known], vs)
    expect(st[0]).toMatchObject({ sameLevel: 2, otherLevel: 1, active: false })
    vs.push((await checkVouch(await vouchFor(w.fp, 38)))!)
    st = wardenStatuses([known], vs)
    expect(st[0].active).toBe(true)
    expect(isActiveWarden(st, w.fp, 38)).toBe(true)
    expect(isActiveWarden(st, w.fp, 12)).toBe(false)
  })

  it('the same resident vouching twice counts once; forged vouches are dropped', async () => {
    const w = await makeWarden(38)
    const v = await vouchFor(w.fp, 38)
    const once = (await checkVouch(v))!
    expect(wardenStatuses([(await checkWardenKey(w.body))!], [once, once, once])[0].sameLevel).toBe(1)
    expect(await checkVouch({ ...v, voucherLevel: 37 })).toBeNull()
  })
})
