import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { resetDemo } from '../../lib/demoReset'
import { Shell } from '../../components/Shell'
import { Button, Card, SimTag } from '../../components/ui'
import { registerPublisher, publishWorld } from '../../lib/worldFeed'
import { SPEEDS, useSim } from '../../stores/simStore'
import { LEVEL_COUNT } from '../../sim/types'
import { isNetworkUp, tickLabel } from '../../sim/world'
import { LevelTable } from './LevelTable'
import { MeshMonitor } from './MeshMonitor'
import { startRelays } from '../../lib/relays'
import { injectFakeReports } from '../../lib/spoof'

const DEEP_LEVELS = [34, 35, 36, 37, 38, 39, 40]

export function SimView() {
  const { world, speedIndex, setSpeed, step, act } = useSim()
  const [level, setLevel] = useState(38)

  // This tab is the world's source of truth: answer new tabs and publish once on open.
  useEffect(() => {
    publishWorld(useSim.getState().world)
    const off = registerPublisher(() => useSim.getState().world)
    return () => {
      off()
      setSpeed(0)
    }
  }, [setSpeed])

  const [relaysOn, setRelaysOn] = useState(true)

  // Simulated neighbour devices (one per level) that relay mesh traffic and emit level alerts.
  useEffect(() => {
    if (!relaysOn) return
    const fleet = startRelays(() => useSim.getState().world)
    const unsub = useSim.subscribe((s, prev) => {
      if (s.world !== prev.world) fleet.onWorld(s.world)
    })
    return () => {
      unsub()
      fleet.stop()
    }
  }, [relaysOn])

  useEffect(() => {
    document.title = 'World Simulator (demo only)'
  }, [])

  const l = world.levels[level - 1]
  const net = isNetworkUp(world, level)

  return (
    <Shell
      view="simulator"
      simulator
      aside={
        <div className="flex items-center gap-2">
          <SimTag>not part of Lantern</SimTag>
          <span className="font-mono text-lamp">{tickLabel(world.tick)}</span>
        </div>
      }
    >
      <div
        role="note"
        className="mb-4 rounded-xl border-2 border-dashed border-sim/60 bg-sim/5 p-4 text-sm text-white"
      >
        <h1 className="font-mono text-base font-bold text-sim uppercase">
          World Simulator — demo only, not part of Lantern
        </h1>
        <p className="mt-1">
          This console stands in for the physical world: power feeders, heat, water, illness, the Directorate's network
          and its official bulletins, plus the phones of thousands of residents we can't put in a browser. Lantern
          itself is <code>/resident</code>, <code>/terminal</code>, <code>/warden</code>, <code>/ledger</code> and{' '}
          <code>/directorate</code>.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card
            title="Clock"
            right={<span className="text-xs text-hollow-500">1 tick = 1 simulated hour</span>}
          >
            <div className="flex flex-wrap gap-2" role="group" aria-label="Simulation speed">
              {SPEEDS.map((s, i) => (
                <Button key={s.label} tone={i === speedIndex ? 'primary' : 'default'} onClick={() => setSpeed(i)}>
                  {s.label}
                </Button>
              ))}
              <Button onClick={step} disabled={speedIndex !== 0}>
                Step +1h
              </Button>
              <Button
                tone="danger"
                onClick={() => {
                  if (confirm('Wipe ALL demo data in every tab and start the demo from the beginning?')) void resetDemo()
                }}
              >
                Reset &amp; set up demo
              </Button>
              <Link to="/demo" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm underline">
                Demo launcher →
              </Link>
            </div>
          </Card>
          <LevelTable world={world} selected={level} onSelect={setLevel} />
        </div>

        <div className="space-y-4">
          <Card title="Scenario">
            <label className="mb-3 flex items-center gap-2 text-sm">
              Target level
              <select
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="min-h-11 rounded-lg border border-hollow-700 bg-hollow-800 px-2"
              >
                {Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Level {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="mb-3 text-xs text-hollow-300">
              L{level}: {l.blackout ? 'blackout' : l.surging ? 'demand climbing' : 'normal'} · network{' '}
              {net ? 'up' : 'down'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => act({ type: 'surge', level })} disabled={l.surging || l.blackout}>
                Power surge
              </Button>
              <Button tone="danger" onClick={() => act({ type: 'blackout', level })} disabled={l.blackout}>
                Force blackout
              </Button>
              <Button onClick={() => act({ type: 'restore', level })}>Restore power</Button>
              <Button onClick={() => act({ type: l.networkUp ? 'networkDown' : 'networkUp', level })}>
                Net {l.networkUp ? 'down' : 'up'} (L{level})
              </Button>
              <Button onClick={() => act({ type: 'contaminateWater', level })}>Contaminate water</Button>
              <Button onClick={() => act({ type: 'cleanWater', level })}>Flush water</Button>
              <Button
                tone={l.airBackup ? 'primary' : 'default'}
                className="col-span-2"
                onClick={() => act({ type: 'airBackup', level, on: !l.airBackup })}
              >
                {l.airBackup ? `Directorate cuts L${level} emergency air line` : `Directorate powers L${level} air pumps`}
              </Button>
              <Button
                tone="danger"
                className="col-span-2"
                onClick={() => injectFakeReports(level, world.tick, isNetworkUp(world, level))}
              >
                Rogue device: inject 300 fake reports on L{level}
              </Button>
            </div>
            <hr className="my-3 border-hollow-800" />
            <div className="grid grid-cols-1 gap-2">
              <Button
                tone={world.globalNetworkDown ? 'danger' : 'default'}
                onClick={() => act({ type: 'globalNetwork', down: !world.globalNetworkDown })}
              >
                {world.globalNetworkDown ? 'Restore Directorate network (all)' : 'Directorate network: shut ALL down'}
              </Button>
              <Button onClick={() => act({ type: 'symptomSpike', levels: DEEP_LEVELS })}>
                Symptom spike, levels 34–40
              </Button>
              <Button onClick={() => act({ type: 'addUsers', count: 500 })}>
                +500 residents join ({world.activeUsers.toLocaleString()})
              </Button>
            </div>
          </Card>

          <Card title="Mesh">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5 accent-amber-400"
                checked={relaysOn}
                onChange={(e) => setRelaysOn(e.target.checked)}
              />
              Neighbour devices relay traffic (1 per level) <SimTag />
            </label>
            <p className="mt-1 text-xs text-hollow-500">
              Devices link over the Directorate net when both ends have it, otherwise by radio to devices within 2
              levels. Off = only the open resident tabs can relay.
            </p>
          </Card>
          <MeshMonitor />

          <Card title="Event log">
            <ol tabIndex={0} aria-label="Event log" className="max-h-72 space-y-1 overflow-auto font-mono text-xs" aria-live="polite">
              {world.log
                .slice()
                .reverse()
                .slice(0, 60)
                .map((e, i) => (
                  <li key={`${e.tick}-${i}`} className="text-hollow-300">
                    <span className="text-hollow-500">{tickLabel(e.tick)}</span> {e.text}
                  </li>
                ))}
            </ol>
          </Card>
        </div>
      </div>
    </Shell>
  )
}
