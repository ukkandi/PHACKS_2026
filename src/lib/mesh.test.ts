import { afterEach, describe, expect, it } from 'vitest'
import { deriveFamilyKey, openJson, sealJson } from './familyCrypto'
import { addCounts, countsAreConsistent, countsFromCheckIn, ZERO_COUNTS } from './reports'
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

  it('does not rebroadcast when everyone already has the Directorate net', async () => {
    const inbox: Packet[] = []
    const a = makeNode({ nodeId: 'a', level: 38, netUp: true }, [])
    const others = [5, 12, 36, 37].map((level) => makeNode({ nodeId: `n${level}`, level, netUp: true }, inbox))
    a.send({ kind: 'alert', level: 38, band: 'warning', riskPct: 60, hoursToFailure: 8, hoursRange: [6, 10], confidence: 'medium', reason: 'x', tick: 1 })
    await new Promise((r) => setTimeout(r, 400))
    expect(inbox).toHaveLength(4)
    expect(others.reduce((n, o) => n + o.relayed, 0)).toBe(0)
  })

  it('net-connected neighbours relay to a nearby offline device (learned from its beacon)', async () => {
    const got: Packet[] = []
    makeNode({ nodeId: 'mara', level: 38, netUp: false }, got)
    const teo = makeNode({ nodeId: 'teo', level: 36, netUp: true }, [])
    const ilan = makeNode({ nodeId: 'ilan', level: 12, netUp: true }, [])
    await new Promise((r) => setTimeout(r, 100)) // first beacon
    ilan.send({ kind: 'sealed', tag: 't', iv: 'x', data: 'y' })
    await new Promise((r) => setTimeout(r, 400))
    expect(got).toHaveLength(1)
    expect(describeRoute(got[0].path)).toBe('L12 ⇢net L36 ⇢radio L38')
    expect(teo.relayed).toBe(1)
  })

  it('anonymous packets do not carry the device id', async () => {
    const got: Packet[] = []
    const a = makeNode({ nodeId: 'secret-device', level: 20, netUp: true }, [])
    makeNode({ nodeId: 'ledger', level: 20, netUp: true }, got)
    a.send({ kind: 'sealed', tag: 't', iv: 'x', data: 'y' }, { anonymous: true })
    await new Promise((r) => setTimeout(r, 100))
    expect(JSON.stringify(got)).not.toContain('secret-device')
  })

  it('crosses a network outage by hopping through nearby levels', async () => {
    // Directorate net is down everywhere: only radio links (±2 levels) work.
    const got: Packet[] = []
    const src = makeNode({ nodeId: 'mara', level: 38, netUp: false }, [])
    for (const level of [36, 34, 32]) makeNode({ nodeId: `relay-${level}`, level, netUp: false }, [])
    makeNode({ nodeId: 'ilan', level: 30, netUp: false }, got)
    const far = makeNode({ nodeId: 'far', level: 10, netUp: false }, [])
    void far

    src.send({ kind: 'alert', level: 38, band: 'blackout', riskPct: 100, hoursToFailure: 0, hoursRange: [0, 0], confidence: 'high', reason: 'x', tick: 1 })
    await new Promise((r) => setTimeout(r, 800))

    expect(got).toHaveLength(1)
    expect(hopCount(got[0].path)).toBe(4)
    expect(describeRoute(got[0].path)).toBe('L38 ⇢radio L36 ⇢radio L34 ⇢radio L32 ⇢radio L30')
  })
})

describe('report counts', () => {
  it('derives coarse counts from a check-in and validates them', () => {
    const c = countsFromCheckIn({ okay: true, mood: 2, sleepHours: 5, symptoms: ['fever', 'cough'], water: 'bad' })
    expect(c).toMatchObject({ reports: 1, symptomatic: 1, fever: 1, respiratory: 1, waterBad: 1, lowMood: 1, shortSleep: 1 })
    const two = addCounts(c, countsFromCheckIn({ okay: false, mood: 4, sleepHours: 8, symptoms: [], water: 'ok' }))
    expect(two.reports).toBe(2)
    expect(countsAreConsistent(two)).toBe(true)
    expect(countsAreConsistent({ ...ZERO_COUNTS, reports: 1, okay: 1, symptomatic: 5, moodSum: 3 })).toBe(false)
  })
})
