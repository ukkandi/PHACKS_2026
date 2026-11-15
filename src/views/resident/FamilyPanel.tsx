import { Card, StateTag, Trust } from '../../components/ui'
import type { FamilyMember } from '../../lib/db'
import { describeRoute, hopCount } from '../../lib/mesh'
import { ago, type State } from '../../lib/status'
import { useFamily } from '../../stores/familyStore'
import { useResident } from '../../stores/residentStore'

function statusOf(last: FamilyMember['lastCheckIn'], tick: number): { word: string; state: State } {
  if (!last) return { word: 'No check-in', state: 'watch' }
  if (!last.okay) return { word: 'Needs help', state: 'danger' }
  if (Math.floor(last.tick / 24) === Math.floor(tick / 24)) return { word: 'Okay today', state: 'normal' }
  return { word: 'Not today', state: 'watch' }
}

const ALERT_WORD = { warning: 'blackout risk', critical: 'blackout risk', blackout: 'BLACKOUT' } as const

export function FamilyPanel({ tick }: { tick: number }) {
  const profile = useResident((s) => s.profile)
  const checkins = useResident((s) => s.checkins)
  const members = useFamily((s) => s.members)
  const alerts = useFamily((s) => s.alerts)
  if (!profile) return null

  const others = Object.values(members).sort((a, b) => a.name.localeCompare(b.name))
  const me = statusOf(checkins[0] ? { tick: checkins[0].tick, okay: checkins[0].okay } : null, tick)

  return (
    <Card
      title={`Family · ${profile.familyCode}`}
      right={<Trust>Encrypted</Trust>}
      help="Family status travels over the mesh, encrypted with your family code. Relays — neighbours' phones, wardens, the Directorate — can't read it. 'Heard … via N hops' shows when and how each update reached you."
    >
      <ul className="divide-y-2 divide-hollow-800">
        <li className="flex items-center justify-between gap-2 py-2">
          <span className="font-mono text-sm font-bold uppercase">
            {profile.name} <span className="font-normal text-hollow-500">(you) · L{profile.level}</span>
          </span>
          <StateTag state={me.state}>{me.word}</StateTag>
        </li>
        {others.map((m) => {
          const st = statusOf(m.lastCheckIn, tick)
          const alert = alerts[m.level]
          const stale = Date.now() - m.receivedAt > 60_000
          const hops = hopCount(m.route)
          return (
            <li key={m.memberId} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold uppercase">
                  {m.name} <span className="font-normal text-hollow-500">· L{m.level}</span>
                </span>
                <span className="flex flex-wrap items-center justify-end gap-3">
                  {alert && alert.band !== 'clear' && (
                    <StateTag state={alert.band === 'warning' ? 'watch' : 'danger'}>
                      L{m.level} {ALERT_WORD[alert.band]}
                    </StateTag>
                  )}
                  <StateTag state={st.state}>{st.word}</StateTag>
                </span>
              </div>
              <div className="mt-0.5" title={describeRoute(m.route)}>
                <Trust tone={stale ? 'warn' : 'ok'}>
                  Heard {ago(m.receivedAt)} · via {hops} hop{hops === 1 ? '' : 's'} · {describeRoute(m.route)}
                </Trust>
              </div>
            </li>
          )
        })}
      </ul>
      {others.length === 0 && <p className="font-mono text-xs text-hollow-500 uppercase">Waiting for family on mesh</p>}
    </Card>
  )
}
