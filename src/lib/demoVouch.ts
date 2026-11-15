// DEMO SETUP — not part of Lantern's rules. In real life a resident vouches by meeting their warden
// and scanning the key on the warden's screen. For the judges' demo, some devices vouch
// automatically for the demo warden the first time they hear its key (trust on first use):
//   - Mara (L38) and Teo (L36) — Teo's vouch is shown but never counted, he lives on another level;
//   - two simulated L38 residents on the World Simulator's level phone (src/lib/relays.ts).
// A key that turns up later claiming the same badge is NOT auto-vouched.
import type { Profile } from './db'

export const DEMO_WARDEN_BADGE = 'W-38-WAR'
export const DEMO_WARDEN_LEVEL = 38
const DEMO_FAMILY = 'ORIN-7'
const AUTO_VOUCHERS = ['Mara', 'Teo']

export function autoVouchesForDemoWarden(profile: Profile): boolean {
  return profile.familyCode === DEMO_FAMILY && AUTO_VOUCHERS.includes(profile.name)
}
