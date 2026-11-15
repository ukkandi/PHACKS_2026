// A ledger node: listens on the mesh for public packets (anonymous summaries, alerts, warden
// verifications) and keeps a rolling copy. Anyone can run one; every copy computes the same view.
import { create } from 'zustand'
import { BASELINE_FROM, type StoredAlert, type StoredSummary, type StoredVerify } from '../lib/ledger'
import { hopCount, MeshNode, type Packet } from '../lib/mesh'
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

/** The running ledger node (used by the warden view to send verifications). */
export function getLedgerNode(): MeshNode | null {
  return node
}

export const useLedger = create<LedgerState>((set, get) => ({
  ...load(),
  running: false,

  start: ({ nodeId, level = LEDGER_LEVEL, onSealed }) => {
    if (node) return
    const onDeliver = (p: Packet) => {
      const b = p.body
      const now = Date.now()
      if (b.kind === 'summary') {
        if (get().summaries.some((s) => s.id === p.id)) return
        const tick = getWorld()?.tick ?? b.tick
        // Keep the rolling window; drop anything from a future tick (the world was reset).
        const summaries = [...get().summaries, { ...b, id: p.id, receivedAt: now, hops: hopCount(p.path) }].filter(
          (s) => s.tick <= tick && tick - s.tick < BASELINE_FROM,
        )
        set({ summaries })
      } else if (b.kind === 'alert') {
        set({ alerts: { ...get().alerts, [b.level]: { ...b, receivedAt: now } } })
      } else if (b.kind === 'verify') {
        set({ verifies: [...get().verifies, { ...b, id: p.id, receivedAt: now }].slice(-200) })
      }
      else if (b.kind === 'sealed') onSealed?.(p) // unreadable unless the caller holds the key
    }
    node = new MeshNode({
      getInfo: () => {
        const w = getWorld()
        return { nodeId, level, netUp: w ? isNetworkUp(w, level) : true }
      },
      onDeliver,
    })
    saveTimer = setInterval(() => {
      const { summaries, alerts, verifies } = get()
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ summaries, alerts, verifies }))
      } catch {
        // storage full: the live view still works
      }
    }, 2000)
    // Pick up anything another ledger tab saved since we loaded.
    set({ ...load(), running: true })
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
