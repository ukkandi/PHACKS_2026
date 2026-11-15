// Demo-only plumbing: lets the World Simulator (or the demo launcher) wipe every tab's data and
// put the whole demo back to its starting state. Not part of Lantern itself.
// Tabs check isResetting() before writing shared storage so nothing old is written back.
const CONTROL = 'lantern-control'
let resetting = false

export function isResetting(): boolean {
  return resetting
}

export function markResetting() {
  resetting = true
}

/** Every tab calls this once: on a reset broadcast, stop writing and reload. */
export function listenForDemoReset() {
  const ch = new BroadcastChannel(CONTROL)
  ch.onmessage = (e: MessageEvent<{ type: string }>) => {
    if (e.data?.type !== 'reset') return
    markResetting()
    // Give the initiating tab a moment to delete storage, then come back fresh.
    setTimeout(() => location.reload(), 700)
  }
}

async function deleteLanternDatabases() {
  const dbs = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : []
  await Promise.all(
    dbs
      .map((d) => d.name)
      .filter((n): n is string => !!n && n.startsWith('lantern-'))
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(name)
            req.onsuccess = req.onerror = req.onblocked = () => resolve()
          }),
      ),
  )
}

/** Wipe all demo data in every tab, then reload this tab. */
export async function resetDemo() {
  markResetting()
  const ch = new BroadcastChannel(CONTROL)
  ch.postMessage({ type: 'reset' })
  ch.close()
  for (const key of Object.keys(localStorage)) if (key.startsWith('lantern-')) localStorage.removeItem(key)
  await deleteLanternDatabases()
  // Clear again in case another tab wrote just before it heard the broadcast.
  for (const key of Object.keys(localStorage)) if (key.startsWith('lantern-')) localStorage.removeItem(key)
  setTimeout(() => location.reload(), 300)
}
