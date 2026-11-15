import { useEffect } from 'react'
import { Shell } from '../../components/Shell'
import { Explain, Sign, Trust } from '../../components/ui'
import { getDeviceId } from '../../lib/device'
import { LedgerBody } from './LedgerBody'

/** Transparency without control: the Directorate sees exactly what the public sees. */
export function DirectorateView() {
  useEffect(() => {
    document.title = 'Directorate view — Lantern'
  }, [])
  return (
    <Shell view="directorate">
      <div className="space-y-3">
        <Sign sub="Same board as the public">Directorate access · read-only</Sign>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Trust>Same data as public</Trust>
          <Trust>No individual data</Trust>
          <Trust>Cannot be switched off</Trust>
          <Explain label="About Directorate access">
            Lantern holds no names, unit numbers or locations of individuals: personal check-ins never leave residents'
            devices, so there is nothing more to request, subpoena or switch off. The network runs on residents' own devices
            and keeps working without the Directorate network.
          </Explain>
        </div>
        <LedgerBody nodeId={`directorate-${getDeviceId()}`} />
      </div>
    </Shell>
  )
}
