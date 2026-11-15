// Coarse, anonymous check-in counts. This is the ONLY thing about a check-in that leaves a device
// for the public ledger: a level number, an hour, and these tallies. No ids, no names, no units.
import type { CheckIn } from './db'

export interface ReportCounts {
  reports: number
  okay: number
  help: number
  /** Any of fever / cough / breathing / stomach. */
  symptomatic: number
  fever: number
  respiratory: number
  stomach: number
  waterBad: number
  /** Mood 1–2. */
  lowMood: number
  /** Under 6 hours. */
  shortSleep: number
  moodSum: number
  sleepSum: number
}

export const ZERO_COUNTS: ReportCounts = {
  reports: 0,
  okay: 0,
  help: 0,
  symptomatic: 0,
  fever: 0,
  respiratory: 0,
  stomach: 0,
  waterBad: 0,
  lowMood: 0,
  shortSleep: 0,
  moodSum: 0,
  sleepSum: 0,
}

export function countsFromCheckIn(c: Pick<CheckIn, 'okay' | 'mood' | 'sleepHours' | 'symptoms' | 'water'>): ReportCounts {
  const has = (s: string) => (c.symptoms as string[]).includes(s)
  const respiratory = has('cough') || has('breathing')
  const symptomatic = has('fever') || respiratory || has('stomach')
  return {
    reports: 1,
    okay: c.okay ? 1 : 0,
    help: c.okay ? 0 : 1,
    symptomatic: symptomatic ? 1 : 0,
    fever: has('fever') ? 1 : 0,
    respiratory: respiratory ? 1 : 0,
    stomach: has('stomach') ? 1 : 0,
    waterBad: c.water === 'bad' ? 1 : 0,
    lowMood: c.mood <= 2 ? 1 : 0,
    shortSleep: c.sleepHours < 6 ? 1 : 0,
    moodSum: c.mood,
    sleepSum: c.sleepHours,
  }
}

export function addCounts(a: ReportCounts, b: ReportCounts): ReportCounts {
  const out = { ...a }
  for (const k of Object.keys(out) as (keyof ReportCounts)[]) out[k] = a[k] + b[k]
  return out
}

/** Reject malformed or impossible counts (e.g. more symptomatic than reports). */
export function countsAreConsistent(c: ReportCounts): boolean {
  const vals = Object.values(c)
  if (vals.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) return false
  const { reports } = c
  return (
    c.okay + c.help === reports &&
    [c.symptomatic, c.fever, c.respiratory, c.stomach, c.waterBad, c.lowMood, c.shortSleep].every((v) => v <= reports) &&
    c.moodSum <= reports * 5 &&
    c.moodSum >= reports &&
    c.sleepSum <= reports * 14
  )
}
