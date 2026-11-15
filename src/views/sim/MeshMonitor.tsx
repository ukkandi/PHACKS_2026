import { useEffect, useRef, useState } from 'react'
import { Card, SimTag } from '../../components/ui'
import { hopCount, MESH_CHANNEL, type Frame } from '../../lib/mesh'
import { timeAgo } from '../../lib/format'

interface Seen {
  id: string
  label: string
  originLevel: number
  firstSeen: number
  frames: number
  maxHops: number
  levels: Set<number>
}

/**
 * Passive radio scanner for the demo operator: shows packets crossing the mesh.
 * Family packets are visible only as encrypted blobs — exactly what any relay sees.
 */
export function MeshMonitor() {
  const seen = useRef(new Map<string, Seen>())
  const [rows, setRows] = useState<Seen[]>([])

  useEffect(() => {
    const ch = new BroadcastChannel(MESH_CHANNEL)
    ch.onmessage = (e: MessageEvent<Frame>) => {
      const { packet } = e.data
      if (!packet) return // beacon
      let s = seen.current.get(packet.id)
      if (!s) {
        const b = packet.body
        s = {
          id: packet.id,
          label:
            b.kind === 'alert'
              ? `alert · L${b.level} ${b.band}${b.band === 'warning' || b.band === 'critical' ? ` ${b.riskPct}%` : ''}`
              : b.kind === 'summary'
                ? `summary · L${b.level} · ${b.counts.reports} reports (${b.source})`
                : b.kind === 'verify'
                  ? `warden ${b.badge} ${b.confirmed ? 'confirms' : 'disputes'} ${b.claim} on L${b.level}`
                  : `sealed · encrypted · tag ${b.tag}`,
          originLevel: packet.path[0].level,
          firstSeen: Date.now(),
          frames: 0,
          maxHops: 0,
          levels: new Set(),
        }
        seen.current.set(packet.id, s)
        if (seen.current.size > 200) {
          const oldest = seen.current.keys().next().value
          if (oldest) seen.current.delete(oldest)
        }
      }
      s.frames++
      s.maxHops = Math.max(s.maxHops, hopCount(packet.path))
      packet.path.forEach((h) => s.levels.add(h.level))
    }
    const t = setInterval(() => {
      setRows(
        Array.from(seen.current.values())
          .sort((a, b) => b.firstSeen - a.firstSeen)
          .slice(0, 25)
          .map((r) => ({ ...r })),
      )
    }, 700)
    return () => {
      clearInterval(t)
      ch.close()
    }
  }, [])

  return (
    <Card title="Mesh traffic" right={<SimTag>radio scanner</SimTag>}>
      {rows.length === 0 ? (
        <p className="text-sm text-hollow-500">No packets yet.</p>
      ) : (
        <ul tabIndex={0} aria-label="Recent mesh packets" className="max-h-72 space-y-1 overflow-auto font-mono text-[11px]">
          {rows.map((r) => (
            <li key={r.id} className="text-hollow-300">
              <span className="text-hollow-500">{timeAgo(r.firstSeen)}</span> from L{r.originLevel} · {r.label}
              <span className="text-hollow-500">
                {' '}
                · {r.frames} relays · ≤{r.maxHops} hops · {r.levels.size} levels
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
