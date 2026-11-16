// Turns changes this phone notices into announcements: own level's power, family check-ins, messages.
// Nothing is announced for what was already there when the phone started listening.
import { useEffect, useRef } from 'react'
import { alertBand, type AlertBand } from '../../lib/alerts'
import { familyPhrase, messagePhrase, powerPhrase } from '../../lib/spokenPhrases'
import { useAlertFeed } from '../../stores/alertFeed'
import { useFamily } from '../../stores/familyStore'
import { predictBlackout } from '../../sim/predict'
import type { World } from '../../sim/types'

export function useAnnouncements(level: number | null, world: World | null) {
  const announce = useAlertFeed((s) => s.announce)
  const running = useFamily((s) => s.running)
  const members = useFamily((s) => s.members)
  const messages = useFamily((s) => s.messages)

  // Own level's power.
  const prevBand = useRef<AlertBand | null>(null)
  useEffect(() => {
    if (!world || !level) return
    const l = world.levels[level - 1]
    const p = predictBlackout(l.loadHistory, { temperature: l.temperature, blackout: l.blackout })
    const band = alertBand(p, l.blackout)
    const prev = prevBand.current
    prevBand.current = band
    if (prev === null) return
    const a = powerPhrase(level, band, prev, p.hoursRange)
    if (a) announce(a)
  }, [world, level, announce])

  // Family check-ins: announce a change for someone we already knew about.
  const prevFamily = useRef<Record<string, string> | null>(null)
  useEffect(() => {
    if (!running) {
      prevFamily.current = null
      return
    }
    const sig = Object.fromEntries(
      Object.values(members).map((m) => [m.memberId, m.lastCheckIn ? `${m.lastCheckIn.tick}:${m.lastCheckIn.okay}` : '']),
    )
    const prev = prevFamily.current
    prevFamily.current = sig
    if (!prev) return
    for (const m of Object.values(members)) {
      if (m.memberId in prev && prev[m.memberId] !== sig[m.memberId] && m.lastCheckIn) announce(familyPhrase(m.name, m.lastCheckIn.okay))
    }
  }, [members, running, announce])

  // Messages from family.
  const seenMessages = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!running) {
      seenMessages.current = null
      return
    }
    if (!seenMessages.current) {
      seenMessages.current = new Set(messages.map((m) => m.id))
      return
    }
    for (const m of [...messages].reverse()) {
      if (seenMessages.current.has(m.id)) continue
      seenMessages.current.add(m.id)
      if (!m.mine) announce(messagePhrase(m.name, m.text))
    }
  }, [messages, running, announce])
}
