// SIMULATED: everything in the world model is a fictional simulation for the demo.

export const LEVEL_COUNT = 40
/** Bump when the World shape changes so stale snapshots in localStorage are discarded. */
export const WORLD_VERSION = 2
/** How many ticks of history each level keeps (1 tick = 1 simulated hour). */
export const HISTORY_LEN = 48

export interface LevelState {
  /** 1 = top (near the surface), 40 = deepest. */
  level: number
  population: number
  /** Megawatts the level's feeder can carry before the breaker trips. */
  powerCapacity: number
  /** Normal demand before any scenario effects, MW. */
  baseLoad: number
  /** Current demand, MW. 0 while blacked out. */
  powerLoad: number
  /** Extra demand added by a scenario surge, MW (grows each tick while surging). */
  surgeLoad: number
  surging: boolean
  temperature: number
  /** 0–100, 100 = clean. */
  waterQuality: number
  /** 0–100, 100 = clean. */
  airQuality: number
  blackout: boolean
  /** Is the Directorate network reachable from this level? */
  networkUp: boolean
  /** Fraction of residents reporting symptoms in the last day (ground truth). */
  symptomRate: number
  /** Normal symptom rate for this level. */
  symptomBaseline: number
  /** Extra symptom rate from an active outbreak; fades slowly. */
  outbreakLoad: number
  /** Tick the current blackout began, or null. */
  blackoutSince: number | null
  /** Air pumps on an emergency line (the Directorate rerouted reserve power to them). */
  airBackup: boolean
  /** Utilisation (load / capacity) history, oldest first. Blackout ticks are recorded as 0. */
  loadHistory: number[]
  tempHistory: number[]
}

export interface SimEvent {
  tick: number
  text: string
  level?: number
}

export interface World {
  version: number
  seed: number
  /** Spare geothermal capacity the Directorate can route anywhere, MW. */
  reserveMW: number
  rngState: number
  tick: number
  /** All-levels Directorate network outage (e.g. the Directorate cuts the net). */
  globalNetworkDown: boolean
  /** Residents using Lantern (synthetic, for the ledger). */
  activeUsers: number
  levels: LevelState[]
  log: SimEvent[]
}

/** Scenario controls the /sim operator can apply. */
export type SimAction =
  | { type: 'surge'; level: number }
  | { type: 'blackout'; level: number }
  | { type: 'restore'; level: number }
  | { type: 'networkDown'; level: number }
  | { type: 'networkUp'; level: number }
  | { type: 'globalNetwork'; down: boolean }
  | { type: 'contaminateWater'; level: number }
  | { type: 'cleanWater'; level: number }
  | { type: 'symptomSpike'; levels: number[] }
  | { type: 'addUsers'; count: number }
  | { type: 'airBackup'; level: number; on: boolean }
