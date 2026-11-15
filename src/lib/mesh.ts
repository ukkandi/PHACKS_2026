// Lantern mesh: gossip flooding between devices, with hop counts and recorded routes.
//
// SIMULATED: the physical layer. Every tab shares one BroadcastChannel, so in software we decide
// whether a frame could actually have reached us:
//   - 'net'   both devices can currently reach the Directorate network, or
//   - 'radio' the devices are within RADIO_RANGE levels of each other (local Wi-Fi/Bluetooth
//             mesh through shafts and stairwells).
// Everything above that (dedup, TTL, relaying, routes) is the real protocol logic.
//
// Relaying is selective: when the sender and I both have the Directorate net, every other
// net-connected device already received the same frame, so I only rebroadcast if a device that is
// OFF the net may be within radio range of me (I know because offline devices send tiny beacons).
import type { ReportCounts } from './reports'

export const MESH_CHANNEL = 'lantern-mesh'
export const RADIO_RANGE = 2
export const DEFAULT_TTL = 24
/** Delay before relaying, so hops are visible (and first arrival ≈ fewest hops). */
export const RELAY_DELAY_MS = 90
/** Offline devices announce themselves this often so net-connected neighbours relay to them. */
export const BEACON_MS = 4000
/** How long an offline neighbour counts as "nearby" after its last frame. */
const OFFLINE_NEIGHBOUR_TTL_MS = 12_000

export interface NodeInfo {
  nodeId: string
  level: number
  netUp: boolean
}

export type Link = 'net' | 'radio'

export interface Hop {
  nodeId: string
  level: number
  link: Link | 'origin'
}

/**
 * End-to-end encrypted payload (family status/messages, or a block's care channel to its warden).
 * Relays can't tell which: they only see a short tag and an opaque blob.
 */
export interface SealedBody {
  kind: 'sealed'
  /** Short hash of the shared code so members can pick out their packets. */
  tag: string
  iv: string
  data: string
}

export interface AlertBody {
  kind: 'alert'
  level: number
  band: 'clear' | 'warning' | 'critical' | 'blackout'
  riskPct: number
  hoursToFailure: number | null
  hoursRange: [number, number | null] | null
  confidence: 'low' | 'medium' | 'high'
  reason: string
  tick: number
}

/** Coarse, anonymous level report: counts only, no identities. Feeds the public ledger. */
export interface SummaryBody {
  kind: 'summary'
  level: number
  /** Simulated hour the reports were made. */
  tick: number
  source: ReportSource
  counts: ReportCounts
  /** Level-meter readings, attached by devices that have them (stand-in phones). */
  conditions?: LevelConditions
}

/** Public level-meter readings + census population. */
export interface LevelConditions {
  temperature: number
  air: number
  powerOut: boolean
  population: number
}

export type ReportSource = 'resident' | 'terminal' | 'warden' | 'standin' | 'unknown'

/** A warden vouching for (or against) what the ledger shows on their level. */
export interface VerifyBody {
  kind: 'verify'
  level: number
  claim: 'outbreak' | 'water' | 'reports'
  confirmed: boolean
  /** Pseudonymous warden badge, e.g. "W-38-2". SIMULATED: production would sign with a warden key. */
  badge: string
  tick: number
  note?: string
}

export type MeshBody = SealedBody | AlertBody | SummaryBody | VerifyBody

export interface Packet {
  id: string
  ttl: number
  createdAt: number
  /** path[0] is the origin; each later hop records the link used to reach that node. */
  path: Hop[]
  body: MeshBody
}

export interface Frame {
  /** Absent for a beacon (an offline device saying "I'm here"). */
  packet?: Packet
  sender: NodeInfo
}

/** Could a frame sent by `a` physically reach `b`? Pure, so it is easy to test. */
export function linkBetween(a: NodeInfo, b: NodeInfo): Link | null {
  if (a.netUp && b.netUp) return 'net'
  if (Math.abs(a.level - b.level) <= RADIO_RANGE) return 'radio'
  return null
}

export function hopCount(path: Hop[]): number {
  return Math.max(0, path.length - 1)
}

/** "L38 ⇢radio L37 ⇢net L12" */
export function describeRoute(path: Hop[]): string {
  return path.map((h, i) => (i === 0 ? `L${h.level}` : `⇢${h.link} L${h.level}`)).join(' ')
}

export interface MeshNodeOptions {
  getInfo: () => NodeInfo
  onDeliver?: (packet: Packet) => void
  /** Called for every in-range frame (even duplicates): lets a device see who is nearby. */
  onFrame?: (sender: NodeInfo, link: Link) => void
  /** Relay packets for others (every Lantern device does by default). */
  relay?: boolean
}

/**
 * Alerts get a deterministic id, so when several devices on a level raise the same alert in the
 * same hour the mesh treats them as one packet instead of flooding duplicates.
 */
export function alertPacketId(a: AlertBody): string {
  return `alert-L${a.level}-${a.band}-t${a.tick}`
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export class MeshNode {
  private channel: BroadcastChannel
  private seen = new Set<string>()
  private opts: MeshNodeOptions
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private offlineNear = new Map<string, { level: number; lastSeen: number }>()
  private lastBeacon = 0
  private beaconTimer: ReturnType<typeof setInterval>
  relayEnabled: boolean
  /** Frames this node has rebroadcast for others (shown on warden devices). */
  relayed = 0

  constructor(opts: MeshNodeOptions) {
    this.opts = opts
    this.relayEnabled = opts.relay ?? true
    this.channel = new BroadcastChannel(MESH_CHANNEL)
    this.channel.onmessage = (e: MessageEvent<Frame>) => this.receive(e.data)
    this.beaconTimer = setInterval(() => this.maybeBeacon(), 1000)
    queueMicrotask(() => this.maybeBeacon())
  }

  private maybeBeacon() {
    const me = this.info
    if (me.netUp || Date.now() - this.lastBeacon < BEACON_MS) return
    this.lastBeacon = Date.now()
    this.channel.postMessage({ sender: me } satisfies Frame)
  }

  private hasOfflineNeighbour(me: NodeInfo): boolean {
    const cutoff = Date.now() - OFFLINE_NEIGHBOUR_TTL_MS
    for (const [id, n] of this.offlineNear) {
      if (n.lastSeen < cutoff) this.offlineNear.delete(id)
      else if (Math.abs(n.level - me.level) <= RADIO_RANGE) return true
    }
    return false
  }

  get info(): NodeInfo {
    return this.opts.getInfo()
  }

  /**
   * Originate a packet. Returns it (with the origin hop) so the caller can show "sent".
   * `anonymous`: the origin hop and the frame carry a throwaway id instead of this device's id.
   */
  send(body: MeshBody, opts: { ttl?: number; id?: string; anonymous?: boolean } = {}): Packet {
    const real = this.info
    const me = opts.anonymous ? { ...real, nodeId: `anon-${Math.random().toString(36).slice(2, 8)}` } : real
    const packet: Packet = {
      id: opts.id ?? (body.kind === 'alert' ? alertPacketId(body) : newId()),
      ttl: opts.ttl ?? DEFAULT_TTL,
      createdAt: Date.now(),
      path: [{ nodeId: me.nodeId, level: me.level, link: 'origin' }],
      body,
    }
    this.markSeen(packet.id)
    this.channel.postMessage({ packet, sender: me } satisfies Frame)
    return packet
  }

  private markSeen(id: string) {
    if (this.seen.size > 5000) this.seen.clear()
    this.seen.add(id)
  }

  private receive(frame: Frame) {
    const me = this.info
    if (frame.sender.nodeId === me.nodeId) return
    const link = linkBetween(frame.sender, me)
    if (!link) return // out of range: this frame never physically reached us
    this.opts.onFrame?.(frame.sender, link)
    if (!frame.sender.netUp) this.offlineNear.set(frame.sender.nodeId, { level: frame.sender.level, lastSeen: Date.now() })
    const { packet } = frame
    if (!packet || this.seen.has(packet.id)) return
    this.markSeen(packet.id)

    const arrived: Packet = { ...packet, path: [...packet.path, { nodeId: me.nodeId, level: me.level, link }] }
    this.opts.onDeliver?.(arrived)

    const someoneMayHaveMissedIt = !me.netUp || link === 'radio' || this.hasOfflineNeighbour(me)
    if (this.relayEnabled && someoneMayHaveMissedIt && hopCount(arrived.path) < packet.ttl) {
      const t = setTimeout(() => {
        this.timers.delete(t)
        this.relayed++
        // Re-read our info: the network state may have changed in the meantime.
        this.channel.postMessage({ packet: arrived, sender: this.info } satisfies Frame)
      }, RELAY_DELAY_MS)
      this.timers.add(t)
    }
  }

  close() {
    clearInterval(this.beaconTimer)
    for (const t of this.timers) clearTimeout(t)
    this.channel.close()
  }
}
