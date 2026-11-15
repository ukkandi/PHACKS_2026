import { describe, expect, it } from 'vitest'
import { predictBlackout, riskBand, slope } from './predict'

describe('slope', () => {
  it('is the least-squares slope', () => {
    expect(slope([1, 2, 3, 4])).toBeCloseTo(1)
    expect(slope([5, 5, 5])).toBe(0)
    expect(slope([1])).toBe(0)
  })
})

describe('predictBlackout', () => {
  it('stable, moderate load → low risk, no failure ETA', () => {
    const p = predictBlackout([0.72, 0.73, 0.72, 0.71, 0.72, 0.72])
    expect(p.hoursToFailure).toBeNull()
    expect(p.riskPct).toBeLessThan(10)
    expect(riskBand(p.riskPct)).toBe('low')
  })

  it('rising load → predicts hours until failure and raises risk', () => {
    // +2%/h from 80% → ~9h of headroom
    const p = predictBlackout([0.7, 0.72, 0.74, 0.76, 0.78, 0.8, 0.82])
    expect(p.hoursToFailure).not.toBeNull()
    expect(p.hoursToFailure!).toBeGreaterThan(6)
    expect(p.hoursToFailure!).toBeLessThan(12)
    expect(p.riskPct).toBeGreaterThanOrEqual(50)
  })

  it('close to failure → critical', () => {
    const p = predictBlackout([0.86, 0.88, 0.9, 0.92, 0.94, 0.96])
    expect(riskBand(p.riskPct)).toBe('critical')
  })

  it('at capacity or in blackout → 100%', () => {
    expect(predictBlackout([0.9, 1.01]).riskPct).toBe(100)
    expect(predictBlackout([0.5], { blackout: true }).riskPct).toBe(100)
  })

  it('heat raises risk a little', () => {
    const h = [0.8, 0.8, 0.8, 0.8, 0.8, 0.8]
    expect(predictBlackout(h, { temperature: 46 }).riskPct).toBeGreaterThan(predictBlackout(h).riskPct)
  })
})
