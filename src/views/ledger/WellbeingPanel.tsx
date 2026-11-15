import { Card } from '../../components/ui'
import { bandStats, type LedgerView } from '../../lib/ledger'

const BANDS = [
  { name: 'Upper 1–10', from: 1, to: 10 },
  { name: 'Middle 11–30', from: 11, to: 30 },
  { name: 'Deep 31–40', from: 31, to: 40 },
]

/** Problem #11: how depth, darkness and heat show up in sleep and mood. */
export function WellbeingPanel({ view }: { view: LedgerView }) {
  const rows = BANDS.map((b) => ({ ...b, ...bandStats(view.levels, b.from, b.to) }))
  const up = rows[0]
  const deep = rows[2]
  const blackoutLevels = view.levels.filter((l) => l.conditions?.powerOut && l.reports > 0)
  const insight =
    up.reports > 0 && deep.reports > 0
      ? `Deep levels report ${(deep.lowMood / Math.max(up.lowMood, 0.01)).toFixed(1)}× the low mood and ${(deep.shortSleep / Math.max(up.shortSleep, 0.01)).toFixed(1)}× the short sleep of levels nearest the light.${
          blackoutLevels.length
            ? ` In the blackout on Level ${blackoutLevels.map((l) => l.level).join(', ')}, ${Math.round(blackoutLevels[0].lowMoodShare * 100)}% report low mood.`
            : ''
        }`
      : 'Not enough reports yet.'
  return (
    <Card title="Sleep & mood by depth" help={insight}>
      <table className="w-full text-left font-mono text-xs uppercase">
        <thead className="text-[10px] tracking-[0.15em] text-hollow-500">
          <tr>
            <th scope="col">Band</th>
            <th scope="col">Low mood</th>
            <th scope="col">Under 6 h</th>
            <th scope="col" className="text-right">Reports</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-hollow-800">
              <th scope="row" className="py-1 font-normal">
                {r.name}
              </th>
              <td className={r.lowMood >= 0.3 ? 'font-bold text-warn' : ''}>{Math.round(r.lowMood * 100)}%</td>
              <td className={r.shortSleep >= 0.3 ? 'font-bold text-warn' : ''}>{Math.round(r.shortSleep * 100)}%</td>
              <td className="text-right text-data">{r.reports}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
