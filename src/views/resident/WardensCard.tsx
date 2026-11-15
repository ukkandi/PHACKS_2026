import { Button, Card, StateTag, Trust } from '../../components/ui'
import { shortFp } from '../../lib/wardenCrypto'
import { useWardenRegistry, VOUCHES_REQUIRED, wardenStatuses } from '../../lib/wardenRegistry'
import { useFamily } from '../../stores/familyStore'

/** Wardens of this resident's level, as this device sees them (signatures checked), with a VOUCH action. */
export function WardensCard({ level }: { level: number }) {
  const wardens = useWardenRegistry((s) => s.wardens)
  const vouches = useWardenRegistry((s) => s.vouches)
  const deviceFp = useFamily((s) => s.deviceFp)
  const vouch = useFamily((s) => s.vouch)
  const mine = wardenStatuses(Object.values(wardens), Object.values(vouches)).filter((s) => s.warden.level === level)
  const iVouched = (fp: string) => Object.values(vouches).some((v) => v.voucherFp === deviceFp && v.wardenFp === fp)

  return (
    <Card
      title={`Wardens · L${level}`}
      right={<Trust>No accounts</Trust>}
      help={`A warden is active once ${VOUCHES_REQUIRED} residents of this level vouch for their key. Vouch only for someone you've met: check that the key on their screen matches the one shown here. Your vouch is signed by a key made on this device — it isn't an account and isn't linked to your check-ins. This phone only sends help requests to active wardens, encrypted to their keys.`}
    >
      {mine.length === 0 ? (
        <StateTag state="nodata">No warden heard</StateTag>
      ) : (
        <ul className="divide-y-2 divide-hollow-800">
          {mine.map((s) => (
            <li key={s.warden.fp} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <div className="font-mono text-sm font-bold uppercase">
                  {s.warden.badge} <span className="font-normal text-hollow-500">· key {shortFp(s.warden.fp)}</span>
                </div>
                <StateTag state={s.active ? 'normal' : 'watch'}>
                  {s.active ? `Active · ${s.sameLevel} vouches` : `Not active · ${s.sameLevel}/${VOUCHES_REQUIRED}`}
                </StateTag>
              </div>
              {iVouched(s.warden.fp) ? (
                <Trust>You vouched</Trust>
              ) : (
                <Button className="min-h-12" onClick={() => void vouch(s.warden.fp)}>
                  Vouch
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
