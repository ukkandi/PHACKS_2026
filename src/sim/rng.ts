/** Mulberry32: tiny seeded PRNG. State is a single uint32 so it can live inside the world snapshot. */
export function nextRandom(state: number): [value: number, nextState: number] {
  let t = (state + 0x6d2b79f5) >>> 0
  const next = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, next]
}

/** Stateful wrapper for code that draws many numbers in a row. */
export class Rng {
  state: number
  constructor(state: number) {
    this.state = state
  }
  next(): number {
    const [v, s] = nextRandom(this.state)
    this.state = s
    return v
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }
  /** Roughly normal noise (sum of uniforms), mean 0. */
  noise(scale: number): number {
    return (this.next() + this.next() + this.next() - 1.5) * scale
  }
}
