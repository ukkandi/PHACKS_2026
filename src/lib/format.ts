import type { BadgeTone } from '../components/ui'
import type { RiskBand } from '../sim/predict'

export const pct = (v: number) => `${Math.round(v * 100)}%`

export function millions(n: number): string {
  return `${(n / 1_000_000).toFixed(1)}M`
}

export const bandTone: Record<RiskBand, BadgeTone> = {
  low: 'ok',
  watch: 'muted',
  warning: 'warn',
  critical: 'danger',
}

export function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.round(m / 60)}h ago`
}
