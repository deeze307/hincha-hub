import type { TeamStanding } from '../../utils/prodeScoring'
import { TeamLogo } from '../atoms/TeamLogo'

export function GroupStandingsTable({
  standings, qualifiers, showBestThird, highlightTeamId, compact,
}: {
  standings:        TeamStanding[]
  qualifiers:       number
  showBestThird:    boolean
  highlightTeamId?: string
  compact?:         boolean
}) {
  const cell = compact ? 'px-1 py-1' : 'px-2 py-1.5'
  const nameW = compact ? 'max-w-[3.5rem]' : 'max-w-24'
  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-border/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-elevated">
            <th className={`${cell} text-left text-muted font-semibold w-4`}>#</th>
            <th className={`${cell} text-left text-muted font-semibold`}>Equipo</th>
            <th className={`${cell} text-center text-muted font-semibold`}>PJ</th>
            <th className={`${cell} text-center text-muted font-semibold`}>PG</th>
            <th className={`${cell} text-center text-muted font-semibold`}>PE</th>
            <th className={`${cell} text-center text-muted font-semibold`}>PP</th>
            <th className={`${cell} text-center text-muted font-semibold`}>GD</th>
            <th className={`${cell} text-center text-muted font-semibold`}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const isQ = i < qualifiers
            const is3rd = !isQ && i === qualifiers
            const isHighlighted = highlightTeamId === s.teamId
            return (
              <tr
                key={s.teamId}
                className={`border-t border-border/30 ${
                  isHighlighted ? 'bg-brand/10' :
                  isQ ? 'bg-green-500/5' : is3rd && showBestThird ? 'bg-yellow-500/5' : ''
                }`}
              >
                <td className={`${cell} text-center`}>
                  <span className={`text-[10px] font-bold ${
                    isQ ? 'text-green-400' : is3rd && showBestThird ? 'text-yellow-400' : 'text-muted'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className={cell}>
                  <div className="flex items-center gap-1">
                    <TeamLogo url={s.logoUrl} name={s.teamName} size={14} />
                    <span className={`text-text font-medium truncate ${nameW}`}>{s.teamName}</span>
                  </div>
                </td>
                <td className={`${cell} text-center text-muted`}>{s.pj}</td>
                <td className={`${cell} text-center text-muted`}>{s.pg}</td>
                <td className={`${cell} text-center text-muted`}>{s.pe}</td>
                <td className={`${cell} text-center text-muted`}>{s.pp}</td>
                <td className={`${cell} text-center text-muted`}>
                  {s.pj > 0 ? (s.gf - s.gc > 0 ? '+' : '') + (s.gf - s.gc) : '—'}
                </td>
                <td className={`${cell} text-center font-bold text-text`}>{s.pts}</td>
              </tr>
            )
          })}
          {standings.length === 0 && (
            <tr>
              <td colSpan={8} className="px-2 py-4 text-center text-muted-dark">
                Completá algún resultado para ver la tabla
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
