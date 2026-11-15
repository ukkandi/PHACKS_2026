// Family packets are end-to-end encrypted with a key derived from the family code.
// Relays (neighbours' devices, wardens, the Directorate) only see an opaque blob and a short tag.
// Note: a short shared code is a weak secret; production would use a proper key exchange
// (e.g. QR-code pairing). Good enough to show the principle in the demo.

const enc = new TextEncoder()
const dec = new TextDecoder()

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export interface FamilyKey {
  tag: string
  key: CryptoKey
}

const keyCache = new Map<string, Promise<FamilyKey>>()

export function deriveFamilyKey(code: string): Promise<FamilyKey> {
  const norm = code.trim().toUpperCase()
  let p = keyCache.get(norm)
  if (!p) {
    p = (async () => {
      const tagHash = await crypto.subtle.digest('SHA-256', enc.encode(`lantern-tag:${norm}`))
      const tag = Array.from(new Uint8Array(tagHash).slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join('')
      const base = await crypto.subtle.importKey('raw', enc.encode(norm), 'PBKDF2', false, ['deriveKey'])
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode('lantern-family-v1'), iterations: 60_000, hash: 'SHA-256' },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
      return { tag, key }
    })()
    keyCache.set(norm, p)
  }
  return p
}

export async function sealJson(fk: FamilyKey, value: unknown): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, fk.key, enc.encode(JSON.stringify(value)))
  return { iv: toB64(iv), data: toB64(data) }
}

/** Returns null if this blob isn't for us (wrong key or tampered). */
export async function openJson<T>(fk: FamilyKey, iv: string, data: string): Promise<T | null> {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, fk.key, fromB64(data))
    return JSON.parse(dec.decode(plain)) as T
  } catch {
    return null
  }
}
