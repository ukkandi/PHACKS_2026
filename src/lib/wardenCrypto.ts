// Real public-key crypto for warden authentication (WebCrypto, no server, no accounts).
//   - Signing: ECDSA P-256 / SHA-256 (supported in every current browser and Node).
//   - Encryption to a warden: ECDH P-256 with a fresh ephemeral key per note → AES-GCM.
// Private keys are generated NON-extractable and only ever live in the device's IndexedDB.

export type PubJwk = { kty: string; crv: string; x: string; y: string }

const enc = new TextEncoder()
const dec = new TextDecoder()
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const
const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Only the public coordinates, in a fixed shape (safe to put in packets). */
export function pubOnly(jwk: JsonWebKey): PubJwk {
  return { kty: jwk.kty!, crv: jwk.crv!, x: jwk.x!, y: jwk.y! }
}

export interface SigningKeys {
  privateKey: CryptoKey
  publicJwk: PubJwk
}

export async function generateSigningKeys(): Promise<SigningKeys> {
  const kp = await crypto.subtle.generateKey(ECDSA, false, ['sign', 'verify'])
  return { privateKey: kp.privateKey, publicJwk: pubOnly(await crypto.subtle.exportKey('jwk', kp.publicKey)) }
}

export async function generateEncryptionKeys(): Promise<SigningKeys> {
  const kp = await crypto.subtle.generateKey(ECDH, false, ['deriveKey'])
  return { privateKey: kp.privateKey, publicJwk: pubOnly(await crypto.subtle.exportKey('jwk', kp.publicKey)) }
}

/** Stable 16-hex-char fingerprint of a public key. */
export async function fingerprint(jwk: PubJwk): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(`${jwk.kty}|${jwk.crv}|${jwk.x}|${jwk.y}`))
  return Array.from(new Uint8Array(h).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** "3F9A·C21B" — the short form shown on screens. */
export function shortFp(fp: string): string {
  return `${fp.slice(0, 4)}·${fp.slice(4, 8)}`.toUpperCase()
}

export async function sign(privateKey: CryptoKey, message: string): Promise<string> {
  return b64(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(message)))
}

/** False for a bad signature, a malformed key, or anything else that doesn't check out. */
export async function verifySig(pub: PubJwk | undefined, message: string, sig: string | undefined): Promise<boolean> {
  if (!pub || !sig) return false
  try {
    const key = await crypto.subtle.importKey('jwk', { ...pub, ext: true }, ECDSA, false, ['verify'])
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(sig), enc.encode(message))
  } catch {
    return false
  }
}

export interface SealedToKey {
  /** Ephemeral public key of the sender for this one message. */
  epk: PubJwk
  iv: string
  data: string
}

async function sharedKey(priv: CryptoKey, pub: PubJwk, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const pubKey = await crypto.subtle.importKey('jwk', { ...pub, ext: true }, ECDH, false, [])
  return crypto.subtle.deriveKey({ name: 'ECDH', public: pubKey }, priv, { name: 'AES-GCM', length: 256 }, false, [usage])
}

/** Encrypt so that only the holder of `recipient`'s private key can read it. */
export async function sealTo(recipient: PubJwk, value: unknown): Promise<SealedToKey> {
  const eph = await crypto.subtle.generateKey(ECDH, true, ['deriveKey'])
  const key = await sharedKey(eph.privateKey, recipient, 'encrypt')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  return { epk: pubOnly(await crypto.subtle.exportKey('jwk', eph.publicKey)), iv: b64(iv), data: b64(data) }
}

/** Null if it wasn't for us or was tampered with. */
export async function openFrom<T>(privateKey: CryptoKey, sealed: SealedToKey): Promise<T | null> {
  try {
    const key = await sharedKey(privateKey, sealed.epk, 'decrypt')
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.data))
    return JSON.parse(dec.decode(plain)) as T
  } catch {
    return null
  }
}

// ── Canonical messages: exactly what gets signed for each packet kind ─────────────────────────
export const msg = {
  wardenKey: (level: number, badge: string, signFp: string, encFp: string) => `wkey|${level}|${badge}|${signFp}|${encFp}`,
  vouch: (voucherLevel: number, wardenFp: string) => `vouch|${voucherLevel}|${wardenFp}`,
  verify: (v: { level: number; claim: string; confirmed: boolean; badge: string; tick: number; note?: string }) =>
    `verify|${v.level}|${v.claim}|${v.confirmed}|${v.badge}|${v.tick}|${v.note ?? ''}`,
  summary: (s: { level: number; tick: number; source: string; counts: object }) => {
    const c = s.counts as Record<string, number>
    return `summary|${s.level}|${s.tick}|${s.source}|${Object.keys(c)
      .sort()
      .map((k) => `${k}=${c[k]}`)
      .join(',')}`
  },
}
