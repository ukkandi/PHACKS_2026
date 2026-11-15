// SIMULATED / DEMO SETUP: the block's existing rounds book — people the warden looks after, many
// without devices. In the demo it's held by the World Simulator's level phone and only ever sent
// ENCRYPTED to a warden key once that key is active (vouched by 3 residents of the level).
// Unit 221 is the one used in the terminal demo.
import type { RosterEntry } from '../lib/wardenDb'

export function demoRoster(level: number): RosterEntry[] {
  return [
    { unit: `${level}-221`, name: 'Mrs. Okafor', age: 84, note: 'No device. On oxygen; uses the level terminal.', vulnerable: true, hasDevice: false },
    { unit: `${level}-305`, name: 'Mr. Brandt', age: 79, note: 'No device, hard of hearing. Knock loudly.', vulnerable: true, hasDevice: false },
    { unit: `${level}-117`, name: 'Dee Halvorsen', age: 41, note: 'Phone broken since the last flood.', vulnerable: false, hasDevice: false },
    { unit: `${level}-402`, name: 'The Aziz twins', age: 7, note: 'Children; parent works double shifts.', vulnerable: true, hasDevice: false },
  ]
}
