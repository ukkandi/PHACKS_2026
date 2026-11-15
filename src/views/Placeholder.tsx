import { Shell } from '../components/Shell'
import { Card } from '../components/ui'

export function Placeholder({ view, phase, purpose }: { view: string; phase: number; purpose: string }) {
  return (
    <Shell view={view}>
      <Card title="Not built yet">
        <p className="text-hollow-300">{purpose}</p>
        <p className="mt-2 text-sm text-hollow-500">Planned for build phase {phase}.</p>
      </Card>
    </Shell>
  )
}
