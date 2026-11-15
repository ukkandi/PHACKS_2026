import { useEffect } from 'react'
import { Shell } from '../../components/Shell'
import { Button } from '../../components/ui'
import { useWorld } from '../../lib/worldFeed'
import { useResident } from '../../stores/residentStore'
import { tickLabel } from '../../sim/world'
import { CheckInCard } from './CheckInCard'
import { HistoryCard } from './HistoryCard'
import { LocalConditions } from './LocalConditions'
import { Setup } from './Setup'

export function ResidentView() {
  const { loaded, profile, load, deviceId, forgetDevice } = useResident()
  const world = useWorld()

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    document.title = profile ? `${profile.name} · L${profile.level} — Lantern` : 'Resident — Lantern'
  }, [profile])

  const tick = world?.tick ?? 0

  return (
    <Shell
      view="resident"
      aside={
        <div className="flex items-center gap-3 text-sm">
          {profile && (
            <span>
              <strong>{profile.name}</strong> <span className="text-hollow-300">· L{profile.level} · unit {profile.unit}</span>
            </span>
          )}
          <span className="font-mono text-xs text-hollow-500">device {deviceId}</span>
          {world && <span className="font-mono text-xs text-lamp">{tickLabel(world.tick)}</span>}
        </div>
      }
    >
      {!loaded ? (
        <p className="text-hollow-300">Opening local storage…</p>
      ) : !profile ? (
        <Setup />
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <CheckInCard tick={tick} />
          </div>
          <div className="space-y-4">
            <LocalConditions world={world} level={profile.level} />
            <HistoryCard />
            <Button
              tone="ghost"
              onClick={() => {
                if (confirm('Erase everything Lantern stored on this device?')) void forgetDevice()
              }}
            >
              Erase this device
            </Button>
          </div>
        </div>
      )}
    </Shell>
  )
}
