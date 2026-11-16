import { useEffect } from 'react'
import { Shell } from '../../components/Shell'
import { Button, Explain, Sign, Trust } from '../../components/ui'
import { ADVICE } from '../../lib/alerts'
import { sectorOf } from '../../lib/status'
import { useWorld } from '../../lib/worldFeed'
import { useFamily } from '../../stores/familyStore'
import { useResident } from '../../stores/residentStore'
import { tickLabel } from '../../sim/world'
import { CheckInFlow } from './CheckInFlow'
import { FamilyPanel } from './FamilyPanel'
import { HistoryCard } from './HistoryCard'
import { LevelStatus } from './LevelStatus'
import { MeshAlertsCard } from './MeshAlertsCard'
import { MeshStatus } from './MeshStatus'
import { MessagesCard } from './MessagesCard'
import { DEMO_FAMILY, PRESETS, Setup } from './Setup'
import { WarningBanner } from './WarningBanner'
import { WardensCard } from './WardensCard'
import { AlertCaption, LiveRegions, VisualPulse } from '../../components/Announcer'
import type { VoiceIntent } from '../../lib/voice'
import { useAlertFeed } from '../../stores/alertFeed'
import { AlertSettings } from './AlertSettings'
import { useAnnouncements } from './useAnnouncements'
import { VoiceCheckIn } from './VoiceCheckIn'

export function ResidentView() {
  const { loaded, profile, load, deviceId, forgetDevice, db } = useResident()
  const world = useWorld()
  const sendStatus = useFamily((s) => s.sendStatus)
  const shareCheckIn = useFamily((s) => s.shareCheckIn)

  useEffect(() => {
    void load()
  }, [load])

  // Demo launcher links (`?as=mara`) set the device up as that family member.
  useEffect(() => {
    if (!loaded || profile) return
    const p = PRESETS.find((x) => x.key === new URLSearchParams(location.search).get('as'))
    if (p) void useResident.getState().saveProfile({ name: p.name, level: p.level, unit: p.unit, familyCode: DEMO_FAMILY })
  }, [loaded, profile])

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
  const blackout = !!(profile && world?.levels[profile.level - 1]?.blackout)

  // Works in the dark: alerts are announced (screen reader, caption, speech, vibration/flash).
  // Blackout mode must be known BEFORE the blackout announcement, so spoken alerts are already on.
  const setBlackout = useAlertFeed((s) => s.setBlackout)
  useEffect(() => setBlackout(blackout), [blackout, setBlackout])
  useAnnouncements(profile?.level ?? null, world)

  /** Voice commands do exactly what the buttons do. */
  const onVoice = async (intent: VoiceIntent) => {
    if (!profile) return
    if (intent === 'okay' || intent === 'help') {
      // Same as I'M OKAY / I NEED HELP → SEND NOW (default details).
      const c = await useResident.getState().addCheckIn({
        tick,
        ts: Date.now(),
        okay: intent === 'okay',
        mood: 3,
        sleepHours: 7,
        symptoms: [],
        water: 'ok',
        level: profile.level,
      })
      void sendStatus()
      void shareCheckIn(c)
    } else {
      await useFamily.getState().sendMessage(intent === 'power-out' ? 'Power is out here.' : 'Need water.')
    }
  }
  const alertLayer = (
    <>
      <LiveRegions />
      <VisualPulse />
    </>
  )

  const aside = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {profile && <MeshStatus world={world} level={profile.level} />}
      <Trust tone="muted">Device {deviceId}</Trust>
      {world && <span className="font-mono text-xs text-lamp">{tickLabel(world.tick)}</span>}
    </div>
  )

  if (!loaded || !profile) {
    return (
      <Shell view="resident" aside={aside}>
        {loaded ? <Setup /> : <p className="font-mono text-xs uppercase">Opening local storage…</p>}
      </Shell>
    )
  }

  const sign = (
    <Sign sub={`${profile.name} · unit ${profile.unit}`}>
      Level {profile.level} · Sector {sectorOf(profile.unit)}
    </Sign>
  )

  // Blackout mode: dim amber on black, only what matters — status, family, messages.
  if (blackout) {
    return (
      <Shell view="resident · blackout" aside={aside} className="blackout-mode">
        {alertLayer}
        <div className="mx-auto max-w-2xl space-y-3">
          <section role="alert" className="border-2 border-danger">
            <div className="hazard h-3" aria-hidden />
            <div className="flex items-start justify-between gap-2 px-3 py-2">
              <div>
                <h1 className="font-mono text-2xl font-bold tracking-[0.08em] text-danger uppercase">Blackout · Level {profile.level}</h1>
                <div className="font-mono text-xs tracking-wider uppercase">
                  Sector {sectorOf(profile.unit)} · {profile.name} · still connected through neighbors' phones
                </div>
              </div>
              <Explain label="What to do">
                <ul className="list-disc space-y-1 pl-5">
                  {ADVICE.blackout.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </Explain>
            </div>
          </section>
          <AlertCaption />
          <VoiceCheckIn big onIntent={onVoice} />
          <LevelStatus world={world} level={profile.level} compact />
          <FamilyPanel tick={tick} />
          <MessagesCard />
          <AlertSettings />
        </div>
      </Shell>
    )
  }

  return (
    <Shell view="resident" aside={aside}>
      {alertLayer}
      <div className="mx-auto max-w-2xl space-y-3">
        {sign}
        <AlertCaption />
        <WarningBanner world={world} level={profile.level} />
        <LevelStatus world={world} level={profile.level} />
        <CheckInFlow
          tick={tick}
          onCheckedIn={(c) => {
            void sendStatus()
            void shareCheckIn(c)
          }}
        />
        <VoiceCheckIn onIntent={onVoice} />
        <AlertSettings />
        <FamilyPanel tick={tick} />
        <MessagesCard />
        <WardensCard level={profile.level} />
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
    </Shell>
  )
}
