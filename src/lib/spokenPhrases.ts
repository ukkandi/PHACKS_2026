// What Lantern says out loud. Short, calm, one idea per sentence, an action where there is one.
// Pure, so the wording can be reviewed and tested.
import type { AlertBand } from './alerts'

export type AlertKind = 'ok' | 'warning' | 'danger' | 'message'

export interface Announcement {
  kind: AlertKind
  /** Spoken and shown as a caption. */
  text: string
}

const hoursPhrase = (range: [number, number | null] | null): string => {
  if (!range) return 'soon'
  const lo = Math.max(1, Math.floor(range[0]))
  if (range[1] === null) return `in ${lo} hours or more`
  const hi = Math.max(lo, Math.ceil(range[1]))
  return lo === hi ? `in about ${lo} hours` : `in ${lo} to ${hi} hours`
}

/** Own level's power situation changed. */
export function powerPhrase(level: number, band: AlertBand, prev: AlertBand, range: [number, number | null] | null): Announcement | null {
  if (band === prev) return null
  if (band === 'blackout')
    return {
      kind: 'danger',
      text: `The power is out on Level ${level}. Lantern is still working through your neighbors' phones. Stay low, stay calm, and save your lamp.`,
    }
  if (band === 'critical')
    return { kind: 'danger', text: `Power warning for Level ${level}. A blackout is very close, ${hoursPhrase(range)}. Charge your lamp and fill water now.` }
  if (band === 'warning')
    return { kind: 'warning', text: `Power warning for Level ${level}. A blackout is likely ${hoursPhrase(range)}. Charge your lamp and fill water.` }
  if (prev === 'blackout') return { kind: 'ok', text: `The power is back on Level ${level}.` }
  return { kind: 'ok', text: `The power warning for Level ${level} has passed.` }
}

export function familyPhrase(name: string, okay: boolean): Announcement {
  return okay
    ? { kind: 'ok', text: `${name} checked in. ${name} is okay.` }
    : { kind: 'danger', text: `${name} has asked for help.` }
}

export function messagePhrase(name: string, text: string): Announcement {
  return { kind: 'message', text: `Message from ${name}. ${text}` }
}
