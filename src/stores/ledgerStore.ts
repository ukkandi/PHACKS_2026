// A ledger node: listens on the mesh for public packets (anonymous summaries, alerts, warden
// verifications) and keeps a rolling copy. Anyone can run one; every copy computes the same view.
// On joining it asks the mesh to catch it up, and it answers other newcomers in turn.
import { create } from 'zustand'
import {
  BASELINE_FROM,
  mergeAlerts,
  mergeSummaries,
  mergeVerifies,
  type StoredAlert,
  type StoredSummary,
  type StoredVerify,
} from '../lib/ledger'
import { hopCount, MeshNode, type Packet, type SyncBody } from '../lib/mesh'
import { isResetting } from '../lib/demoReset'
import { getWorld } from '../lib/worldFeed'
import { isNetworkUp } from '../sim/world'

const STORAGE_KEY = 'lantern-ledger-v1'
/** SIMULATED placement: the ledger node sits on a mid level (radio physics need a location). */
export const LEDGER_LEVEL = 20

interface Persisted {
  summaries: StoredSummary[]
  alerts: Record<number, StoredAlert>
  verifies: StoredVerify[]
}

interface LedgerState extends Persisted {
  running: boolean
  /** Reports received through catch-up since this node started (shown while filling in). */
  caughtUp: number
  /**
   * Join the mesh as a ledger node. `level` = where this device physically is (default: the
   * public ledger node's level). `onSealed` lets a warden device read its block's care notes
   * through the same node.
   */
  start: (opts: { nodeId: string; level?: number; onSealed?: (p: Packet) => void }) => void
  stop: () => void
  /** Raw anonymous data for download — so anyone can check the numbers. */
  exportJson: () => string
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Persisted
  } catch {
    // ignore
  }
  return { summaries: [], alerts: {}, verifies: [] }
}

let node: MeshNode | null = null
let saveTimer: ReturnType<typeof setInterval> | null = null
const answered = new Set<string>()

/** The running ledger node (used by the warden view to send verifications). */
export function getLedgerNode(): MeshNode | null {
  return node
}

const currentTick = (fallback: number) => getWorld()?.tick ?? fallback

export const useLedger = create<LedgerState>((set, get) => ({
  ...load(),
  running: false,
  caughtUp: 0,

  start: ({ nodeId, level = LEDGER_LEVEL, onSealed }) => {
    if (node) return
    const ingestSync = (b: SyncBody) => {
      const now = Date.now()
      const maxTick = Math.max(0, ...(b.summaries ?? []).map((s) => s.tick))
      const before = get().summaries.length
      const summaries = b.summaries ? mergeSummaries(get().summaries, b.summaries, currentTick(maxTick), now) : get().summaries
      set({
        summaries,
        alerts: b.alerts ? mergeAlerts(get().alerts, b.alerts, now) : get().alerts,
        verifies: b.verifies ? mergeVerifies(get().verifies, b.verifies, now) : get().verifies,
        caughtUp: get().caughtUp + Math.max(0, summaries.length - before),
      })
    }
    const onDeliver = (p: Packet) => {
      const b = p.body
      const now = Date.now()
      if (b.kind === 'summary') {
        set({ summaries: mergeSummaries(get().summaries, [{ ...b, id: p.id, hops: hopCount(p.path) }], currentTick(b.tick), now) })
      } else if (b.kind === 'alert') {
        set({ alerts: mergeAlerts(get().alerts, [b], now) })
      } else if (b.kind === 'verify') {
        set({ verifies: mergeVerifies(get().verifies, [{ ...b, id: p.id }], now) })
      } else if (b.kind === 'sync') {
        ingestSync(b)
      } else if (b.kind === 'sync-req') {
        // Another device just joined: share our copy (jittered so several copies don't collide).
        if (answered.has(b.requestId) || (get().summaries.length === 0 && Object.keys(get().alerts).length === 0)) return
        answered.add(b.requestId)
        setTimeout(
          () => {
            const { summaries, alerts, verifies } = get()
            node?.send({
              kind: 'sync',
              requestId: b.requestId,
              from: 'ledger-copy',
              summaries: b.want.includes('summaries') ? summaries.map(({ receivedAt: _r, hops: _h, ...s }) => s) : undefined,
              alerts: b.want.includes('alerts') ? Object.values(alerts).map(({ receivedAt: _r, ...a }) => a) : undefined,
              verifies: b.want.includes('verifies') ? verifies.map(({ receivedAt: _r, ...v }) => v) : undefined,
            })
          },
          150 + Math.random() * 450,
        )
      } else if (b.kind === 'sealed') onSealed?.(p) // unreadable unless the caller holds the key
    }
    node = new MeshNode({
      getInfo: () => {
        const w = getWorld()
        return { nodeId, level, netUp: w ? isNetworkUp(w, level) : true }
      },
      onDeliver,
    })
    saveTimer = setInterval(() => {
      if (isResetting()) return
      const { summaries, alerts, verifies } = get()
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ summaries, alerts, verifies }))
      } catch {
        // storage full: the live view still works
      }
    }, 2000)
    // Start from anything another ledger tab saved, then ask the mesh for what we're missing.
    const saved = load()
    const tick = currentTick(Math.max(0, ...saved.summaries.map((s) => s.tick)))
    set({ ...saved, summaries: saved.summaries.filter((s) => s.tick <= tick && tick - s.tick < BASELINE_FROM), running: true, caughtUp: 0 })
    const requestId = `sync-${nodeId}-${Date.now().toString(36)}`
    answered.add(requestId)
    setTimeout(() => node?.send({ kind: 'sync-req', requestId, want: ['summaries', 'alerts', 'verifies'] }), 200)
  },

  stop: () => {
    node?.close()
    node = null
    if (saveTimer) clearInterval(saveTimer)
    saveTimer = null
    set({ running: false })
  },

  exportJson: () => {
    const { summaries, alerts, verifies } = get()
    return JSON.stringify({ exportedAt: new Date().toISOString(), summaries, alerts, verifies }, null, 2)
  },
}))
