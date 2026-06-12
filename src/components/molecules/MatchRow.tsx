import type { CompetitionMatch } from '../../services/matchesService'
import { teamAbbr } from '../../utils/teamUtils'
import {
  isMatchLocked, isMatchLate, isMatchLive, formatPredTime, LATE_HOURS,
  type ScoreInput, type TeamRef,
} from '../../utils/prodeScoring'
import { TeamLogo } from '../atoms/TeamLogo'
import { ScoreBox } from '../atoms/ScoreBox'

export function MatchRow({
  match, pred, onChange, onTeamClick, competitionCountry, competitionName,
}: {
  match:               CompetitionMatch
  pred:                ScoreInput
  onChange:            (home: string, away: string) => void
  onTeamClick?:        (team: TeamRef) => void
  competitionCountry?: string
  competitionName?:    string
}) {
  const locked   = isMatchLocked(match) || pred.is_modified
  const isLate   = isMatchLate(match)
  const live     = isMatchLive(match)
  const hasScore = match.home_score != null && match.away_score != null
  const isPast   = hasScore || (match.match_date != null && new Date(match.match_date) < new Date())

  const predTimeColor = (() => {
    if (!pred.predicted_at || !match.match_date) return null
    const delta = new Date(match.match_date).getTime() - new Date(pred.predicted_at).getTime()
    return delta >= LATE_HOURS * 3_600_000 ? 'text-green-400' : 'text-orange-400'
  })()

  const displayPts = hasScore ? pred.pts : null

  const dateStr = match.match_date
    ? new Date(match.match_date).toLocaleString('es-AR', {
        weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—'

  return (
    <div className={`border-b border-border/40 last:border-0 ${
      isPast ? 'bg-black/20' : isLate ? 'bg-yellow-500/5' : ''
    }`}>

      {/* Timestamp row — fuera del flex de equipos para no romper el layout */}
      {pred.exists_in_db && pred.predicted_at && predTimeColor && (
        <div className="flex items-center justify-center gap-1 pt-2 px-3">
          <span className="text-muted-dark text-[9px]">cargado el</span>
          <span className={`text-[10px] font-mono ${predTimeColor}`}>
            {formatPredTime(pred.predicted_at)}
          </span>
          {pred.is_modified && (
            <span className="text-[8px] text-muted bg-elevated border border-border/50 rounded px-1 py-px leading-none">
              editado
            </span>
          )}
        </div>
      )}

    <div className="flex items-center gap-1.5 px-2 py-2.5">

      {/* Equipo local */}
      <div className="flex-1 flex items-center justify-end gap-1 min-w-0">
        <button
          type="button"
          onClick={() => match.home_team && onTeamClick?.({ id: match.home_team.id, name: match.home_team.name, logo_url: match.home_team.logo_url ?? null })}
          className="flex items-center gap-1 min-w-0 hover:opacity-70 transition-opacity"
        >
          <span className={`text-sm font-medium truncate text-right hidden sm:block ${isPast ? 'text-muted' : 'text-text'}`}>
            {match.home_team?.name ?? '—'}
          </span>
          <span className={`text-xs font-bold tracking-wide shrink-0 sm:hidden ${isPast ? 'text-muted' : 'text-text'}`}>
            {match.home_team ? teamAbbr(match.home_team.name, competitionCountry, competitionName) : '—'}
          </span>
          <TeamLogo url={match.home_team?.logo_url ?? null} name={match.home_team?.name ?? '?'} />
        </button>
      </div>

      {/* Centro: VIVO + inputs + ½ pts */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        {live && (
          <span className="text-red-500 text-[9px] font-bold uppercase tracking-wider leading-none">VIVO</span>
        )}
        <div className="flex items-center gap-1">
          <ScoreBox value={pred.home} onChange={v => onChange(v, pred.away)} locked={locked} />
          <span className="text-muted-dark text-xs font-semibold">-</span>
          <ScoreBox value={pred.away} onChange={v => onChange(pred.home, v)} locked={locked} />
        </div>
        {isLate && (
          <span className="text-yellow-400 text-[10px] font-semibold leading-none">½ pts</span>
        )}
      </div>

      {/* Equipo visitante */}
      <div className="flex-1 flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={() => match.away_team && onTeamClick?.({ id: match.away_team.id, name: match.away_team.name, logo_url: match.away_team.logo_url ?? null })}
          className="flex items-center gap-1 min-w-0 hover:opacity-70 transition-opacity"
        >
          <TeamLogo url={match.away_team?.logo_url ?? null} name={match.away_team?.name ?? '?'} />
          <span className={`text-sm font-medium truncate hidden sm:block ${isPast ? 'text-muted' : 'text-text'}`}>
            {match.away_team?.name ?? '—'}
          </span>
          <span className={`text-xs font-bold tracking-wide shrink-0 sm:hidden ${isPast ? 'text-muted' : 'text-text'}`}>
            {match.away_team ? teamAbbr(match.away_team.name, competitionCountry, competitionName) : '—'}
          </span>
        </button>
      </div>

      {/* Resultado real + pts / fecha */}
      <div className="shrink-0 w-16 text-right">
        {hasScore ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className={`text-xs font-mono font-semibold ${live ? 'text-red-400' : 'text-muted-dark'}`}>
              {match.home_score} - {match.away_score}
            </span>
            {displayPts != null && (
              <span className={`text-[11px] font-bold ${
                displayPts >= 8 ? 'text-green-400' :
                displayPts >= 3 ? 'text-yellow-400' :
                displayPts >  0 ? 'text-orange-400' :
                'text-red-400'
              }`}>+{displayPts}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-dark text-[11px] leading-tight">{dateStr}</span>
        )}
      </div>
    </div>
    </div>
  )
}
