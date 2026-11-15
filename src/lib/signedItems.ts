// Signature checks for warden-signed ledger items, done once on arrival.
// (Whether the key is a vouched warden is decided later, at view time, from the registry.)
import type { SignatureCheck } from './ledger'
import type { SummaryBody, VerifyBody } from './mesh'
import { fingerprint, msg, verifySig } from './wardenCrypto'

export async function checkVerify(b: VerifyBody): Promise<SignatureCheck> {
  if (!b.signPub || !b.sig) return { signerFp: undefined, sigValid: false }
  return { signerFp: await fingerprint(b.signPub), sigValid: await verifySig(b.signPub, msg.verify(b), b.sig) }
}

export async function checkSummary(b: SummaryBody): Promise<SignatureCheck> {
  if (b.source !== 'warden') return {}
  if (!b.wardenSig) return { signerFp: undefined, sigValid: false }
  return {
    signerFp: await fingerprint(b.wardenSig.signPub),
    sigValid: await verifySig(b.wardenSig.signPub, msg.summary(b), b.wardenSig.sig),
  }
}
