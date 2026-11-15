// Demo-only plumbing: lets the World Simulator wipe every tab's data and start the demo fresh.
// Tabs check isResetting() before writing shared storage so nothing old is written back.
let resetting = false

export function isResetting(): boolean {
  return resetting
}

export function markResetting() {
  resetting = true
}
