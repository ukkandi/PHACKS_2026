// SIMULATED: check-ins from the thousands of residents we can't open browser tabs for.
// One stand-in phone per level batches its neighbours' coarse counts every few hours. The counts
// are drawn from the world's ground truth with realistic sampling noise.
import { ZERO_COUNTS, type ReportCounts } from '../lib/reports'
import { Rng } from './rng'
import type { LevelState, World } from './types'

/** How often (in ticks) each level's stand-in phone sends a batch. Staggered by level. */
export const STANDIN_EVERY = 3

export function standInDue(tick: number, level: number): boolean {
  return (tick + level) % STANDIN_EVERY === 0
}

function hash(...xs: number[]): number {
  let h = 2166136261
  for (const x of xs) {
    h ^= x >>> 0
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

/** Binomial-ish draw: n trials at probability p (normal approximation, clamped). */
function draw(rng: Rng, n: number, p: number): number {
  const mean = n * p
  const sd = Math.sqrt(n * p * (1 - p))
  return Math.max(0, Math.min(n, Math.round(mean + rng.noise(sd * 2))))
}

export function usersOnLevel(world: World, l: LevelState): number {
  const totalPop = world.levels.reduce((a, x) => a + x.population, 0)
  return Math.round((world.activeUsers * l.population) / totalPop)
}

/** Coarse counts for the residents on a level who checked in during the last `hours` hours. */
export function standInCounts(world: World, l: LevelState, hours = STANDIN_EVERY): ReportCounts {
  const rng = new Rng(hash(world.seed, world.tick, l.level))
  const expected = (usersOnLevel(world, l) * hours) / 24
  const n = Math.max(0, Math.round(expected + rng.noise(Math.sqrt(expected) * 2)))
  if (n === 0) return { ...ZERO_COUNTS }

  const stress = (l.blackout ? 0.25 : 0) + Math.max(0, l.temperature - 40) * 0.03 + l.outbreakLoad
  const helpP = Math.min(0.5, 0.01 + (l.blackout ? 0.05 : 0) + l.outbreakLoad * 0.2)
  const help = draw(rng, n, helpP)
  const symptomatic = draw(rng, n, l.symptomRate)
  const fever = Math.min(symptomatic, draw(rng, symptomatic, l.outbreakLoad > 0.02 ? 0.7 : 0.35))
  const respiratory = Math.min(symptomatic, draw(rng, symptomatic, l.airQuality < 70 ? 0.7 : 0.4))
  const stomach = Math.min(symptomatic, draw(rng, symptomatic, l.waterQuality < 70 ? 0.7 : 0.25))
  const waterBadP = l.waterQuality < 70 ? 0.15 + (70 - l.waterQuality) / 60 : 0.03
  const lowMoodP = Math.min(0.9, 0.12 + stress + ((l.level - 1) / 39) * 0.1)
  const shortSleepP = Math.min(0.9, 0.15 + stress * 0.8 + ((l.level - 1) / 39) * 0.08)
  const lowMood = draw(rng, n, lowMoodP)
  const shortSleep = draw(rng, n, shortSleepP)
  return {
    reports: n,
    okay: n - help,
    help,
    symptomatic,
    fever,
    respiratory,
    stomach,
    waterBad: draw(rng, n, Math.min(0.95, waterBadP)),
    lowMood,
    shortSleep,
    // Low-mood residents average ~1.6, others ~3.6.
    moodSum: Math.round(lowMood * 1.6 + (n - lowMood) * 3.6),
    sleepSum: Math.round(shortSleep * 4.5 + (n - shortSleep) * 7.2),
  }
}
