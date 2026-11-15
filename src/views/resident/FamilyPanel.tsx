import { Badge, Card, type BadgeTone } from '../../components/ui'
import type { FamilyMember } from '../../lib/db'
import { timeAgo } from '../../lib/format'
import { describeRoute, hopCount } from '../../lib/mesh'
import { useFamily } from '../../stores/familyStore'
import { useResident } from '../../stores/residentStore'

function statusOf(last: FamilyMember['lastCheckIn'], tick: number): { label: string; tone: BadgeTone } {
  if (!last) return { label: 'No check-in yet', tone: 'muted' }
  if (!last.okay) return { label: 'Needs help', tone: 'danger' }
  if (Math.floor(last.tick / 24) === Math.floor(tick / 24)) return { label: 'Okay today', tone: 'ok' }
  return { label: 'Not checked in today', tone: 'warn' }
}

const BAND_LABEL = { warning: 'blackout warning', critical: 'blackout imminent', blackout: 'BLACKOUT' } as const

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
      right={<span className="text-xs text-hollow-500">end-to-end encrypted</span>}
    >
      <ul className="divide-y divide-hollow-800">
        <li className="flex items-center justify-between py-2">
          <span>
            {profile.name} <span className="text-hollow-500">(you) · L{profile.level}</span>
          </span>
          <Badge tone={me.tone}>{me.label}</Badge>
        </li>
        {others.map((m) => {
          const st = statusOf(m.lastCheckIn, tick)
          const alert = alerts[m.level]
          const stale = Date.now() - m.receivedAt > 60_000
          return (
            <li key={m.memberId} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {m.name} <span className="text-hollow-500">· L{m.level} · {m.unit}</span>
                </span>
                <span className="flex flex-wrap justify-end gap-1">
                  {alert && alert.band !== 'clear' && (
                    <Badge tone={alert.band === 'warning' ? 'warn' : 'danger'}>
                      L{m.level} {BAND_LABEL[alert.band]}
                    </Badge>
                  )}
                  <Badge tone={st.tone}>{st.label}</Badge>
                </span>
              </div>
              <div className={`mt-0.5 font-mono text-[11px] ${stale ? 'text-warn' : 'text-hollow-500'}`}>
                heard {timeAgo(m.receivedAt)} · {hopCount(m.route)} hop{hopCount(m.route) === 1 ? '' : 's'}: {describeRoute(m.route)}
              </div>
            </li>
          )
        })}
      </ul>
      {others.length === 0 && (
        <p className="mt-2 text-sm text-hollow-300">
          Waiting to hear from family. Open another <code>/resident</code> tab and join family{' '}
          <strong>{profile.familyCode}</strong>.
        </p>
      )}
    </Card>
  )
}
