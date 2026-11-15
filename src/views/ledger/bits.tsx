import { Badge } from '../../components/ui'
import type { Confidence } from '../../lib/ledger'

export function ConfidenceBadge({ c }: { c: Confidence }) {
  return <Badge tone={c === 'high' ? 'ok' : c === 'medium' ? 'muted' : 'warn'}>{c} confidence</Badge>
}
