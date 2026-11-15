// Operator-side state for the /sim tab: owns the authoritative World and the tick loop.
import { create } from 'zustand'
import type { SimAction, World } from '../sim/types'
import { applyAction, createWorld, tickWorld } from '../sim/world'
import { loadStoredWorld, publishWorld } from '../lib/worldFeed'

export const SPEEDS = [
  { label: 'Paused', ms: 0 },
  { label: '1 h / 3 s', ms: 3000 },
  { label: '1 h / s', ms: 1000 },
  { label: '4 h / s', ms: 250 },
] as const

interface SimState {
  world: World
  speedIndex: number
  setSpeed: (i: number) => void
  step: () => void
  act: (a: SimAction) => void
  reset: () => void
}

let timer: ReturnType<typeof setInterval> | null = null

export const useSim = create<SimState>((set, get) => {
  const commit = (world: World) => {
    publishWorld(world)
    set({ world })
  }
  return {
    world: loadStoredWorld() ?? createWorld(),
    speedIndex: 0,
    setSpeed: (i) => {
      if (timer) clearInterval(timer)
      timer = null
      const ms = SPEEDS[i].ms
      if (ms > 0) timer = setInterval(() => get().step(), ms)
      set({ speedIndex: i })
    },
    step: () => commit(tickWorld(get().world)),
    act: (a) => commit(applyAction(get().world, a)),
    reset: () => commit(createWorld()),
  }
})
