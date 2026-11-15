import { useEffect } from 'react'
import { Shell } from '../../components/Shell'
import { Button } from '../../components/ui'
import { useWorld } from '../../lib/worldFeed'
import { useFamily } from '../../stores/familyStore'
import { useResident } from '../../stores/residentStore'
import { tickLabel } from '../../sim/world'
import { CheckInCard } from './CheckInCard'
import { FamilyPanel } from './FamilyPanel'
import { HistoryCard } from './HistoryCard'
import { LocalConditions } from './LocalConditions'
import { MeshAlertsCard } from './MeshAlertsCard'
import { MeshStatus } from './MeshStatus'
import { MessagesCard } from './MessagesCard'
import { Setup } from './Setup'
import { WarningBanner } from './WarningBanner'

export function ResidentView() {
  const { loaded, profile, load, deviceId, forgetDevice, db } = useResident()
  const world = useWorld()
  const sendStatus = useFamily((s) => s.sendStatus)
  const shareCheckIn = useFamily((s) => s.shareCheckIn)

  useEffect(() => {
    void load()
  }, [load])

  // Join the mesh once we know who we are.
  useEffect(() => {
    if (!profile) return
    void useFamily.getState().start({
      profile,
      db,
      deviceId,
      getLastCheckIn: () => {
        const c = useResident.getState().checkins[0]
        return c ? { tick: c.tick, okay: c.okay } : null
      },
    })
    return () => useFamily.getState().stop()
  }, [profile, db, deviceId])

  useEffect(() => {
    document.title = profile ? `${profile.name} · L${profile.level} — Lantern` : 'Resident — Lantern'
  }, [profile])

  const tick = world?.tick ?? 0

  return (
    <Shell
      view="resident"
      aside={
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {profile && (
            <span>
              <strong>{profile.name}</strong>{' '}
              <span className="text-hollow-300">
                · L{profile.level} · unit {profile.unit}
              </span>
            </span>
          )}
          {profile && <MeshStatus world={world} level={profile.level} />}
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
        <div className="space-y-4">
          <WarningBanner world={world} level={profile.level} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <CheckInCard
                tick={tick}
                onCheckedIn={(c) => {
                  void sendStatus()
                  void shareCheckIn(c)
                }}
              />
              <MessagesCard />
            </div>
            <div className="space-y-4">
              <FamilyPanel tick={tick} />
              <LocalConditions world={world} level={profile.level} />
              <MeshAlertsCard />
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
        </div>
      )}
    </Shell>
  )
}
