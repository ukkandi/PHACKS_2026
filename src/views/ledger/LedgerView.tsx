import { useEffect } from 'react'
import { Shell } from '../../components/Shell'
import { Sign } from '../../components/ui'
import { getDeviceId } from '../../lib/device'
import { LedgerBody } from './LedgerBody'

export function LedgerView() {
  useEffect(() => {
    document.title = 'Public Ledger — Lantern'
  }, [])
  return (
    <Shell view="public ledger">
      <div className="space-y-3">
        <Sign sub="What residents report · next to the official figures">Public ledger · all levels</Sign>
        <LedgerBody nodeId={`ledger-${getDeviceId()}`} />
      </div>
    </Shell>
  )
}
