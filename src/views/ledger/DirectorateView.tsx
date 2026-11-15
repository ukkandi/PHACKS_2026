import { useEffect } from 'react'
import { Shell } from '../../components/Shell'
import { getDeviceId } from '../../lib/device'
import { LedgerBody } from './LedgerBody'

/** Transparency without control: the Directorate sees exactly what the public sees. */
export function DirectorateView() {
  useEffect(() => {
    document.title = 'Directorate view — Lantern'
  }, [])
  return (
    <Shell view="directorate (read-only)">
      <section role="note" className="mb-4 rounded-xl border border-hollow-500 bg-hollow-900 p-4">
        <h1 className="text-xl font-bold">Directorate access — read-only</h1>
        <p className="mt-1 text-sm text-hollow-300">
          You are seeing exactly what every resident sees on the public ledger. Lantern holds no names, unit numbers or
          locations of individuals: personal check-ins never leave residents' devices, so there is nothing more to request,
          subpoena or switch off. The network runs on residents' own devices and keeps working without the Directorate
          network.
        </p>
      </section>
      <LedgerBody nodeId={`directorate-${getDeviceId()}`} readOnly />
    </Shell>
  )
}
