import { useEffect } from 'react'
import { Shell } from '../../components/Shell'
import { getDeviceId } from '../../lib/device'
import { LedgerBody } from './LedgerBody'

export function LedgerView() {
  useEffect(() => {
    document.title = 'Public Ledger — Lantern'
  }, [])
  return (
    <Shell view="public ledger">
      <h1 className="mb-1 text-2xl font-bold">Public Ledger</h1>
      <p className="mb-4 max-w-3xl text-hollow-300">
        What residents of the Hollow are actually reporting, level by level — next to what the Directorate says.
      </p>
      <LedgerBody nodeId={`ledger-${getDeviceId()}`} />
    </Shell>
  )
}
