// SIMULATED: deterministic, seeded model of the Hollow. Not real physics — just enough
// structure (depth → heat, cooling → load, blackout → heat/air) for the demo to be coherent.
import { Rng } from './rng'
import { HISTORY_LEN, LEVEL_COUNT, WORLD_VERSION, type LevelState, type SimAction, type World } from './types'

export const DEFAULT_SEED = 2087

/** Hour-of-day demand multiplier: lights-on peak in the "evening", trough at "night". */
export function dailyCycle(tick: number): number {
  const hour = ((tick % 24) + 24) % 24
  return 1 + 0.03 * Math.sin(((hour - 12) / 24) * Math.PI * 2)
}

/** Depth makes levels hotter: ~22 °C at the top, ~46 °C at the bottom (before cooling failures). */
export function ambientTemp(level: number): number {
  return 22 + (level - 1) * 0.62
}

/** Cooling demand grows with temperature above 24 °C (MW per °C, per level). */
function coolingLoad(temp: number): number {
  return Math.max(0, temp - 24) * 0.35
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp

function pushHistory(arr: number[], v: number): number[] {
  const out = arr.length >= HISTORY_LEN ? arr.slice(arr.length - HISTORY_LEN + 1) : arr.slice()
  out.push(round(v, 4))
  return out
}

export function createWorld(seed = DEFAULT_SEED): World {
  const rng = new Rng(seed)
  const levels: LevelState[] = []
  for (let level = 1; level <= LEVEL_COUNT; level++) {
    const depth = (level - 1) / (LEVEL_COUNT - 1)
    const temperature = round(ambientTemp(level) - 2 + rng.noise(1), 1)
    const powerCapacity = round(rng.range(38, 46), 1)
    // Deep levels run closer to their limit: aging feeders, more cooling.
    const utilisation = 0.6 + depth * 0.18 + rng.noise(0.05)
    const baseLoad = round(powerCapacity * utilisation - coolingLoad(temperature), 2)
    const powerLoad = round(baseLoad + coolingLoad(temperature), 2)
    const symptomBaseline = round(0.02 + depth * 0.03 + rng.range(0, 0.01), 3)
    levels.push({
      level,
      population: Math.round(rng.range(42, 58) * 1_000_000),
      powerCapacity,
      baseLoad,
      powerLoad,
      surgeLoad: 0,
      surging: false,
      temperature,
      waterQuality: round(96 - depth * 10 + rng.noise(3), 1),
      airQuality: round(95 - depth * 18 + rng.noise(3), 1),
      blackout: false,
      networkUp: true,
      symptomRate: symptomBaseline,
      symptomBaseline,
      outbreakLoad: 0,
      blackoutSince: null,
      airBackup: false,
      // Two days of meter history, so devices can compare "now" with the same hour yesterday.
      loadHistory: Array.from({ length: HISTORY_LEN }, (_, i) =>
        round(((baseLoad + coolingLoad(temperature)) * dailyCycle(i - HISTORY_LEN)) / powerCapacity + rng.noise(0.012), 4),
      ),
      tempHistory: Array.from({ length: HISTORY_LEN }, () => temperature),
    })
  }
  return {
    version: WORLD_VERSION,
    seed,
    reserveMW: 14,
    rngState: rng.state,
    tick: 0,
    globalNetworkDown: false,
    activeUsers: 12000,
    levels,
    log: [{ tick: 0, text: 'Simulation started. All levels nominal.' }],
  }
}

/** Is the Directorate network reachable on this level right now? */
export function isNetworkUp(world: World, level: number): boolean {
  const l = world.levels[level - 1]
  return !!l && l.networkUp && !world.globalNetworkDown
}

/** Advance the world by one tick (1 simulated hour). Pure: returns a new World. */
export function tickWorld(world: World): World {
  const rng = new Rng(world.rngState)
  const tick = world.tick + 1
  const log = world.log.slice()

  const levels = world.levels.map((l): LevelState => {
    const next: LevelState = { ...l }

    // Temperature: drifts toward ambient while powered (cooling works); heats up in a blackout.
    const ambient = ambientTemp(l.level)
    if (l.blackout) {
      next.temperature = round(l.temperature + 0.7 + rng.noise(0.2), 1)
    } else {
      next.temperature = round(l.temperature + (ambient - 2 - l.temperature) * 0.15 + rng.noise(0.3), 1)
    }

    if (l.surging) next.surgeLoad = round(l.surgeLoad + l.powerCapacity * 0.018, 2)

    if (l.blackout) {
      next.powerLoad = 0
    } else {
      next.powerLoad = round(
        Math.max(0, (l.baseLoad + coolingLoad(next.temperature)) * dailyCycle(tick) + next.surgeLoad + rng.noise(0.6)),
        2,
      )
      if (next.powerLoad >= l.powerCapacity) {
        next.blackout = true
        next.blackoutSince = tick
        next.surging = false
        next.networkUp = false
        log.push({
          tick,
          level: l.level,
          text: `Level ${l.level} feeder tripped at ${next.powerLoad.toFixed(1)} MW — blackout. Directorate network lost on level.`,
        })
        next.powerLoad = 0
      }
    }

    // Air: pumps stop in a blackout (unless on backup power); slowly recovers otherwise.
    const airTarget = 95 - ((l.level - 1) / (LEVEL_COUNT - 1)) * 18
    const pumpsOff = next.blackout && !l.airBackup
    next.airQuality = round(
      clamp(pumpsOff ? l.airQuality - 2.5 : l.airQuality + (airTarget - l.airQuality) * 0.1, 0, 100),
      1,
    )
    // Water recovers slowly toward normal unless contaminated (contamination sets it low and it lingers).
    const waterTarget = 96 - ((l.level - 1) / (LEVEL_COUNT - 1)) * 10
    next.waterQuality = round(clamp(l.waterQuality + (waterTarget - l.waterQuality) * 0.03, 0, 100), 1)
    // Symptoms decay toward baseline; heat and bad water push them up.
    const heatPush = Math.max(0, next.temperature - 40) * 0.002
    const waterPush = Math.max(0, 70 - next.waterQuality) * 0.0015
    next.outbreakLoad = round(l.outbreakLoad * 0.985, 4)
    const target = l.symptomBaseline + next.outbreakLoad
    next.symptomRate = round(clamp(l.symptomRate + (target - l.symptomRate) * 0.15 + heatPush + waterPush, 0, 1), 4)

    next.loadHistory = pushHistory(l.loadHistory, next.blackout ? 0 : next.powerLoad / l.powerCapacity)
    next.tempHistory = pushHistory(l.tempHistory, next.temperature)
    return next
  })

  // Synthetic adoption: a few people join each hour.
  const activeUsers = world.activeUsers + Math.round(rng.range(0, 6))

  return { ...world, tick, rngState: rng.state, levels, activeUsers, log: log.slice(-200) }
}

function updateLevel(world: World, level: number, fn: (l: LevelState) => Partial<LevelState>, text: string): World {
  if (level < 1 || level > LEVEL_COUNT) return world
  const levels = world.levels.map((l) => (l.level === level ? { ...l, ...fn(l) } : l))
  return { ...world, levels, log: [...world.log, { tick: world.tick, level, text }].slice(-200) }
}

/** Apply an operator scenario action. Pure. */
export function applyAction(world: World, action: SimAction): World {
  switch (action.type) {
    case 'surge':
      return updateLevel(
        world,
        action.level,
        () => ({ surging: true }),
        `Level ${action.level}: power demand starts climbing (failing heat exchanger).`,
      )
    case 'blackout':
      return updateLevel(
        world,
        action.level,
        () => ({ blackout: true, blackoutSince: world.tick, surging: false, powerLoad: 0, networkUp: false }),
        `Level ${action.level}: forced blackout. Directorate network lost on level.`,
      )
    case 'restore':
      return updateLevel(
        world,
        action.level,
        () => ({ blackout: false, blackoutSince: null, surging: false, surgeLoad: 0, networkUp: true, airBackup: false }),
        `Level ${action.level}: power and network restored.`,
      )
    case 'networkDown':
      return updateLevel(world, action.level, () => ({ networkUp: false }), `Level ${action.level}: Directorate network down.`)
    case 'networkUp':
      return updateLevel(world, action.level, () => ({ networkUp: true }), `Level ${action.level}: Directorate network back.`)
    case 'globalNetwork':
      return {
        ...world,
        globalNetworkDown: action.down,
        log: [
          ...world.log,
          {
            tick: world.tick,
            text: action.down
              ? 'Directorate network shut down on ALL levels.'
              : 'Directorate network restored on all levels.',
          },
        ].slice(-200),
      }
    case 'contaminateWater':
      return updateLevel(
        world,
        action.level,
        () => ({ waterQuality: 38 }),
        `Level ${action.level}: recycler fault — water contaminated.`,
      )
    case 'cleanWater':
      return updateLevel(world, action.level, (l) => ({ waterQuality: Math.max(l.waterQuality, 90) }), `Level ${action.level}: water flushed.`)
    case 'symptomSpike': {
      let w = world
      for (const level of action.levels) {
        w = updateLevel(
          w,
          level,
          (l) => ({ outbreakLoad: Math.min(0.5, l.outbreakLoad + 0.12), symptomRate: Math.min(1, l.symptomRate + 0.1) }),
          `Level ${level}: fever and cough spreading.`,
        )
      }
      return w
    }
    case 'airBackup':
      return updateLevel(
        world,
        action.level,
        () => ({ airBackup: action.on }),
        action.on
          ? `Directorate reroutes reserve power to Level ${action.level} air pumps.`
          : `Level ${action.level} air pumps back on normal feeder.`,
      )
    case 'addUsers':
      return {
        ...world,
        activeUsers: world.activeUsers + action.count,
        log: [...world.log, { tick: world.tick, text: `${action.count} more residents joined Lantern.` }].slice(-200),
      }
  }
}

/** "Day 3, 14:00" style label for a tick. */
export function tickLabel(tick: number): string {
  const day = Math.floor(tick / 24) + 1
  const hour = tick % 24
  return `Day ${day}, ${String(hour).padStart(2, '0')}:00`
}
