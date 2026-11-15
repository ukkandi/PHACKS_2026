import { afterEach, describe, expect, it } from 'vitest'
import { deriveFamilyKey, openJson, sealJson } from './familyCrypto'
import { describeRoute, hopCount, linkBetween, MeshNode, type NodeInfo, type Packet } from './mesh'

describe('linkBetween', () => {
  it('uses the Directorate net when both ends have it', () => {
    expect(linkBetween({ nodeId: 'a', level: 38, netUp: true }, { nodeId: 'b', level: 2, netUp: true })).toBe('net')
  })
  it('falls back to radio for nearby levels', () => {
    expect(linkBetween({ nodeId: 'a', level: 38, netUp: false }, { nodeId: 'b', level: 36, netUp: true })).toBe('radio')
  })
  it('no link when far apart without the net', () => {
    expect(linkBetween({ nodeId: 'a', level: 38, netUp: false }, { nodeId: 'b', level: 12, netUp: true })).toBeNull()
  })
})

describe('family crypto', () => {
  it('round-trips, and other families cannot read it', async () => {
    const k = await deriveFamilyKey('orin-7')
    const other = await deriveFamilyKey('VALE-2')
    const sealed = await sealJson(k, { hi: 1 })
    expect(await openJson(await deriveFamilyKey('ORIN-7'), sealed.iv, sealed.data)).toEqual({ hi: 1 })
    expect(await openJson(other, sealed.iv, sealed.data)).toBeNull()
    expect(k.tag).not.toBe(other.tag)
  })
})

describe('MeshNode flooding (real BroadcastChannel)', () => {
  const nodes: MeshNode[] = []
  afterEach(() => {
    nodes.splice(0).forEach((n) => n.close())
  })

  function makeNode(info: NodeInfo, inbox: Packet[]) {
    const n = new MeshNode({ getInfo: () => info, onDeliver: (p) => inbox.push(p) })
    nodes.push(n)
    return n
  }

  it('crosses a network outage by hopping through nearby levels', async () => {
    // Directorate net is down everywhere: only radio links (±2 levels) work.
    const got: Packet[] = []
    const src = makeNode({ nodeId: 'mara', level: 38, netUp: false }, [])
    for (const level of [36, 34, 32]) makeNode({ nodeId: `relay-${level}`, level, netUp: false }, [])
    makeNode({ nodeId: 'ilan', level: 30, netUp: false }, got)
    const far = makeNode({ nodeId: 'far', level: 10, netUp: false }, [])
    void far

    src.send({ kind: 'alert', level: 38, band: 'blackout', riskPct: 100, hoursToFailure: 0, reason: 'x', tick: 1 })
    await new Promise((r) => setTimeout(r, 800))

    expect(got).toHaveLength(1)
    expect(hopCount(got[0].path)).toBe(4)
    expect(describeRoute(got[0].path)).toBe('L38 ⇢radio L36 ⇢radio L34 ⇢radio L32 ⇢radio L30')
  })
})
