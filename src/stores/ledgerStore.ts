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
  start: (nodeId: string) => void
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

export const useLedger = create<LedgerState>((set, get) => ({
  ...load(),
  running: false,

  start: (nodeId) => {
    if (node) return
    const onDeliver = (p: Packet) => {
      const b = p.body
      const now = Date.now()
      if (b.kind === 'summary') {
        if (get().summaries.some((s) => s.id === p.id)) return
        const tick = getWorld()?.tick ?? b.tick
        const summaries = [...get().summaries, { ...b, id: p.id, receivedAt: now, hops: hopCount(p.path) }].filter(
          (s) => tick - s.tick < BASELINE_FROM,
        )
        set({ summaries })
      } else if (b.kind === 'alert') {
        set({ alerts: { ...get().alerts, [b.level]: { ...b, receivedAt: now } } })
      } else if (b.kind === 'verify') {
        set({ verifies: [...get().verifies, { ...b, id: p.id, receivedAt: now }].slice(-200) })
      }
      // 'sealed' packets are relayed but unreadable here — by design.
    }
    node = new MeshNode({
      getInfo: () => {
        const w = getWorld()
        return { nodeId, level: LEDGER_LEVEL, netUp: w ? isNetworkUp(w, LEDGER_LEVEL) : true }
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
