// Who is a real warden? Decided by every device for itself, from signed packets only:
//   - a warden key counts once its self-signature checks out;
//   - it becomes ACTIVE when VOUCHES_REQUIRED distinct resident device keys from the SAME level
//     have signed a vouch for it.
// No server, no accounts, no list handed down by anyone.
import { create } from 'zustand'
import type { VouchBody, WardenKeyBody } from './mesh'
import { fingerprint, msg, verifySig, type PubJwk } from './wardenCrypto'

export const VOUCHES_REQUIRED = 3

export interface KnownWarden {
  fp: string
  level: number
  badge: string
  signPub: PubJwk
  encPub: PubJwk
  body: WardenKeyBody
}

export interface KnownVouch {
  voucherFp: string
  voucherLevel: number
  wardenFp: string
  body: VouchBody
}

export interface WardenStatus {
  warden: KnownWarden
  /** Distinct vouchers from the warden's own level. */
  sameLevel: number
  /** Vouches from other levels: shown, never counted. */
  otherLevel: number
  active: boolean
}

/** Pure: status of every known warden. */
export function wardenStatuses(wardens: KnownWarden[], vouches: KnownVouch[]): WardenStatus[] {
  return wardens.map((w) => {
    const vs = vouches.filter((v) => v.wardenFp === w.fp && v.voucherFp !== w.fp)
    const same = new Set(vs.filter((v) => v.voucherLevel === w.level).map((v) => v.voucherFp))
    const other = new Set(vs.filter((v) => v.voucherLevel !== w.level).map((v) => v.voucherFp))
    return { warden: w, sameLevel: same.size, otherLevel: other.size, active: same.size >= VOUCHES_REQUIRED }
  })
}

/** Pure: is this key an active warden for this level? */
export function isActiveWarden(statuses: WardenStatus[], fp: string, level: number): boolean {
  return statuses.some((s) => s.active && s.warden.fp === fp && s.warden.level === level)
}

/** Check a key announcement's self-signature. */
export async function checkWardenKey(b: WardenKeyBody): Promise<KnownWarden | null> {
  const fp = await fingerprint(b.signPub)
  const encFp = await fingerprint(b.encPub)
  return (await verifySig(b.signPub, msg.wardenKey(b.level, b.badge, fp, encFp), b.sig))
    ? { fp, level: b.level, badge: b.badge, signPub: b.signPub, encPub: b.encPub, body: b }
    : null
}

/** Check a vouch's signature. */
export async function checkVouch(b: VouchBody): Promise<KnownVouch | null> {
  return (await verifySig(b.voucherPub, msg.vouch(b.voucherLevel, b.wardenFp), b.sig))
    ? { voucherFp: await fingerprint(b.voucherPub), voucherLevel: b.voucherLevel, wardenFp: b.wardenFp, body: b }
    : null
}

interface RegistryState {
  wardens: Record<string, KnownWarden>
  vouches: Record<string, KnownVouch>
  /** Feed any packet a device receives; only warden-key / vouch are used. Invalid ones are dropped. */
  ingest: (b: WardenKeyBody | VouchBody) => Promise<void>
  statuses: () => WardenStatus[]
  /** Signed packets this device holds, to share with devices that ask to catch up. */
  shareable: () => { wardenKeys: WardenKeyBody[]; vouches: VouchBody[] }
  clear: () => void
}

/** This device's view of the warden registry (one per tab = per device). */
export const useWardenRegistry = create<RegistryState>((set, get) => ({
  wardens: {},
  vouches: {},
  ingest: async (b) => {
    if (b.kind === 'warden-key') {
      const w = await checkWardenKey(b)
      if (w && !get().wardens[w.fp]) set({ wardens: { ...get().wardens, [w.fp]: w } })
    } else {
      const v = await checkVouch(b)
      const id = v ? `${v.voucherFp}>${v.wardenFp}` : ''
      if (v && !get().vouches[id]) set({ vouches: { ...get().vouches, [id]: v } })
    }
  },
  statuses: () => wardenStatuses(Object.values(get().wardens), Object.values(get().vouches)),
  shareable: () => ({
    wardenKeys: Object.values(get().wardens).map((w) => w.body),
    vouches: Object.values(get().vouches).map((v) => v.body),
  }),
  clear: () => set({ wardens: {}, vouches: {} }),
}))

/** Route a delivered mesh body to the registry if it's warden-related (sync replies included). */
export function feedRegistry(b: { kind: string } & Partial<{ wardenKeys: WardenKeyBody[]; vouches: VouchBody[] }>) {
  const reg = useWardenRegistry.getState()
  if (b.kind === 'warden-key' || b.kind === 'vouch') void reg.ingest(b as WardenKeyBody | VouchBody)
  if (b.kind === 'sync') {
    for (const k of b.wardenKeys ?? []) void reg.ingest(k)
    for (const v of b.vouches ?? []) void reg.ingest(v)
  }
}

/** Packet ids are derived from content so re-announcements de-duplicate across the mesh. */
export const wardenKeyPacketId = (fp: string) => `wkey-${fp}`
export const vouchPacketId = (voucherFp: string, wardenFp: string) => `vouch-${voucherFp}-${wardenFp}`
