// SIMULATED: the "world feed" stands in for physical reality — level meters, sensors, the
// state of the Directorate network. The /sim tab owns the world and broadcasts it to every
// tab. It is deliberately separate from the Lantern mesh (src/lib/mesh.ts), which is the
// actual product's peer-to-peer messaging layer.
import { useSyncExternalStore } from 'react'
import type { World } from '../sim/types'

const CHANNEL = 'lantern-world'
const STORAGE_KEY = 'lantern-world-v1'

type FeedMessage = { type: 'snapshot'; world: World } | { type: 'hello' }

function readStored(): World | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as World) : null
  } catch {
    return null
  }
}

let current: World | null = typeof localStorage !== 'undefined' ? readStored() : null
let lastUpdate = current ? Date.now() : 0
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null
/** Set by the /sim tab so it can answer "hello" from newly opened tabs. */
let publisher: (() => World | null) | null = null

function emit() {
  for (const l of listeners) l()
}

function ensureChannel(): BroadcastChannel {
  if (channel) return channel
  channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (e: MessageEvent<FeedMessage>) => {
    const msg = e.data
    if (msg.type === 'snapshot') {
      current = msg.world
      lastUpdate = Date.now()
      emit()
    } else if (msg.type === 'hello' && publisher) {
      const w = publisher()
      if (w) channel?.postMessage({ type: 'snapshot', world: w } satisfies FeedMessage)
    }
  }
  return channel
}

/** Called by the /sim tab whenever the world changes. */
export function publishWorld(world: World) {
  current = world
  lastUpdate = Date.now()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(world))
  } catch {
    // Storage full or unavailable: live broadcast still works.
  }
  ensureChannel().postMessage({ type: 'snapshot', world } satisfies FeedMessage)
  emit()
}

export function registerPublisher(fn: () => World | null) {
  publisher = fn
  ensureChannel()
  return () => {
    if (publisher === fn) publisher = null
  }
}

export function loadStoredWorld(): World | null {
  return readStored()
}

export function getWorld(): World | null {
  return current
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const ch = ensureChannel()
  if (listeners.size === 1) ch.postMessage({ type: 'hello' } satisfies FeedMessage)
  return () => {
    listeners.delete(cb)
  }
}

/** React hook: latest world snapshot (or null if no simulator has ever run). */
export function useWorld(): World | null {
  return useSyncExternalStore(subscribe, () => current)
}

/** Milliseconds since the last world update arrived (for a "sensor feed stale" hint). */
export function feedAgeMs(): number {
  return lastUpdate ? Date.now() - lastUpdate : Infinity
}
