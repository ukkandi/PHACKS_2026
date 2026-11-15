import { Badge } from '../../components/ui'
import { bandTone, millions, pct } from '../../lib/format'
import { predictBlackout, riskBand } from '../../sim/predict'
import type { World } from '../../sim/types'
import { isNetworkUp } from '../../sim/world'

export function LevelTable({
  world,
  selected,
  onSelect,
}: {
  world: World
  selected: number
  onSelect: (level: number) => void
}) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-hollow-800">
      <table className="w-full text-left font-mono text-xs">
        <thead className="sticky top-0 bg-hollow-900 text-hollow-300">
          <tr>
            <th className="px-2 py-1">Lvl</th>
            <th className="px-2 py-1">Pop</th>
            <th className="px-2 py-1">Power load</th>
            <th className="px-2 py-1">Temp</th>
            <th className="px-2 py-1">Water</th>
            <th className="px-2 py-1">Air</th>
            <th className="px-2 py-1">Sympt.</th>
            <th className="px-2 py-1">Blackout risk</th>
            <th className="px-2 py-1">Net</th>
          </tr>
        </thead>
        <tbody>
          {world.levels.map((l) => {
            const p = predictBlackout(l.loadHistory, { temperature: l.temperature, blackout: l.blackout })
            const util = l.blackout ? 0 : l.powerLoad / l.powerCapacity
            const net = isNetworkUp(world, l.level)
            return (
              <tr
                key={l.level}
                onClick={() => onSelect(l.level)}
                className={`cursor-pointer border-t border-hollow-800 ${
                  selected === l.level ? 'bg-lamp/10' : l.blackout ? 'bg-danger/10' : 'hover:bg-hollow-800'
                }`}
              >
                <td className="px-2 py-1">
                  <button type="button" className="font-bold" onClick={() => onSelect(l.level)}>
                    L{l.level}
                  </button>
                </td>
                <td className="px-2 py-1 text-hollow-300">{millions(l.population)}</td>
                <td className="px-2 py-1">
                  {l.blackout ? (
                    <span className="text-danger">BLACKOUT</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded bg-hollow-800">
                        <div
                          className={`h-2 rounded ${util > 0.92 ? 'bg-danger' : util > 0.85 ? 'bg-warn' : 'bg-ok'}`}
                          style={{ width: `${Math.min(100, util * 100)}%` }}
                        />
                      </div>
                      {pct(util)}
                      {l.surging && <span className="text-warn">▲</span>}
                    </div>
                  )}
                </td>
                <td className={`px-2 py-1 ${l.temperature > 44 ? 'text-danger' : ''}`}>{l.temperature.toFixed(1)}°</td>
                <td className={`px-2 py-1 ${l.waterQuality < 70 ? 'text-danger' : ''}`}>{Math.round(l.waterQuality)}</td>
                <td className={`px-2 py-1 ${l.airQuality < 65 ? 'text-danger' : ''}`}>{Math.round(l.airQuality)}</td>
                <td className={`px-2 py-1 ${l.symptomRate > l.symptomBaseline * 2 ? 'text-danger' : ''}`}>
                  {(l.symptomRate * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-1">
                  <Badge tone={bandTone[riskBand(p.riskPct)]}>
                    {p.riskPct}%{p.hoursToFailure !== null && p.hoursToFailure > 0 ? ` · ~${Math.round(p.hoursToFailure)}h` : ''}
                  </Badge>
                </td>
                <td className="px-2 py-1">{net ? <span className="text-ok">up</span> : <span className="text-danger">down</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
