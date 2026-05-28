import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchMatchesForDate } from '../../../services/dashboardService'
import { TeamDetailSheet } from '../TeamDetailSheet'
import { useTeamDetail } from '../../../hooks/useTeamDetail'
import { fetchUserPredictionsForMatches } from '../../../services/predictionsService'
import { isLive } from '../../../hooks/useMatchesForDate'
import { teamAbbr } from '../../../utils/teamUtils'
import type { TeamDetailInfo } from '../../../hooks/useTeamDetail'
import type { TournamentTodayMatches } from '../../../services/dashboardService'
import type { CompetitionMatch } from '../../../services/matchesService'

type TeamRef   = { id: string; name: string; logo_url: string | null }
type MatchPred = { home: number; away: number }

const MAX_PER_COMPETITION = 2
const MAX_COMPETITIONS    = 2

function TeamLogo({ url, name, size = 20 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size }} className="object-contain shrink-0" />
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      className="rounded-full bg-elevated border border-border flex items-center justify-center font-bold text-muted shrink-0"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function MatchRow({ match, pred, onTeamClick, competitionCountry, competitionName }: {
  match:               CompetitionMatch
  pred?:               MatchPred
  onTeamClick?:        (team: TeamRef) => void
  competitionCountry?: string
  competitionName?:    string
}) {
  const live      = isLive(match.status)
  const hasResult = match.home_score != null && match.away_score != null
  const time      = match.match_date
    ? new Date(match.match_date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto_1fr] items-center gap-1.5 px-4 py-2.5 border-b border-border/30 last:border-0">
      <div className="flex flex-col items-center shrink-0">
        {live
          ? <span className="text-green-400 text-[9px] font-bold uppercase">EN VIVO</span>
          : <span className="text-[11px] font-semibold text-muted-dark text-center">{time}</span>}
      </div>

      {/* Local: nombre + logo + pred */}
      <div className="flex items-center gap-1 min-w-0 justify-end">
        <button
          type="button"
          onClick={() => match.home_team && onTeamClick?.({ id: match.home_team.id, name: match.home_team.name, logo_url: match.home_team.logo_url ?? null })}
          className="flex items-center gap-1.5 min-w-0 justify-end hover:opacity-70 transition-opacity"
        >
          <span className="hidden sm:inline text-text text-xs font-semibold truncate">{match.home_team?.name ?? '—'}</span>
          <span className="sm:hidden text-text text-xs font-bold tracking-wide shrink-0">{match.home_team ? teamAbbr(match.home_team.name, competitionCountry, competitionName) : '—'}</span>
          <TeamLogo url={match.home_team?.logo_url ?? null} name={match.home_team?.name ?? '?'} />
        </button>
        {pred != null && (
          <span className="text-brand text-[10px] font-mono tabular-nums shrink-0 font-semibold">{pred.home}</span>
        )}
      </div>

      {/* Marcador central */}
      <div className="shrink-0 w-10 text-center">
        {hasResult
          ? <span className={`text-xs font-bold tabular-nums ${live ? 'text-green-400' : 'text-text'}`}>{match.home_score}-{match.away_score}</span>
          : <span className="text-muted-dark text-[11px]">vs</span>}
      </div>

      {/* Visitante: pred + logo + nombre */}
      <div className="flex items-center gap-1 min-w-0">
        {pred != null && (
          <span className="text-brand text-[10px] font-mono tabular-nums shrink-0 font-semibold">{pred.away}</span>
        )}
        <button
          type="button"
          onClick={() => match.away_team && onTeamClick?.({ id: match.away_team.id, name: match.away_team.name, logo_url: match.away_team.logo_url ?? null })}
          className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition-opacity"
        >
          <TeamLogo url={match.away_team?.logo_url ?? null} name={match.away_team?.name ?? '?'} />
          <span className="hidden sm:inline text-text text-xs font-semibold truncate">{match.away_team?.name ?? '—'}</span>
          <span className="sm:hidden text-text text-xs font-bold tracking-wide shrink-0">{match.away_team ? teamAbbr(match.away_team.name, competitionCountry, competitionName) : '—'}</span>
        </button>
      </div>
    </div>
  )
}

export default function MatchesCard() {
  const [groups,  setGroups]  = useState<TournamentTodayMatches[]>([])
  const [loading, setLoading] = useState(true)
  const [predMap, setPredMap] = useState<Map<string, MatchPred>>(new Map())
  const navigate = useNavigate()
  const { current: teamDetail, open: openTeamDetail, close: closeTeamDetail } = useTeamDetail()

  useEffect(() => {
    fetchMatchesForDate(new Date())
      .then(data => {
        setGroups(data)
        const allIds = data.flatMap(g => g.matches.map(m => m.id))
        if (allIds.length) {
          fetchUserPredictionsForMatches(allIds).then(setPredMap).catch(() => {})
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function handleTeamClick(team: TeamRef, m: CompetitionMatch, tournamentName: string) {
    openTeamDetail({
      team,
      competitionId:   m.competition_id,
      seasonYear:      m.season_year,
      competitionName: tournamentName,
    } satisfies TeamDetailInfo)
  }

  const limited = groups
    .slice(0, MAX_COMPETITIONS)
    .map(g => ({ ...g, matches: g.matches.slice(0, MAX_PER_COMPETITION) }))

  const totalToday = groups.reduce((sum, g) => sum + g.matches.length, 0)
  const hasMore    = totalToday > limited.reduce((sum, g) => sum + g.matches.length, 0)

  return (
    <div className="lg:col-span-4 card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Partidos de hoy</span>
          <p className="text-muted-dark text-[9px] mt-0.5">De tus torneos inscriptos</p>
        </div>
        <button
          onClick={() => navigate('/partidos')}
          className="text-brand text-xs font-semibold hover:underline shrink-0"
        >
          Ver todos {hasMore && `(+${totalToday - limited.reduce((s, g) => s + g.matches.length, 0)})`}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="text-brand animate-spin" />
        </div>
      ) : limited.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-5 text-center gap-2">
          <span className="text-2xl">📅</span>
          <p className="text-text text-sm font-medium">Sin partidos hoy en tus torneos</p>
          <p className="text-muted text-xs leading-snug">
            Puede haber partidos de competiciones populares disponibles
          </p>
          <button
            onClick={() => navigate('/partidos')}
            className="mt-1 text-brand text-xs font-semibold hover:underline"
          >
            Ver calendario completo →
          </button>
        </div>
      ) : (
        <div>
          {limited.map(g => (
            <div key={g.tournamentId}>
              <div className="flex items-center gap-2 px-4 py-2 bg-elevated/60 border-b border-border/50">
                {g.competitionLogo
                  ? <img src={g.competitionLogo} alt="" className="w-4 h-4 object-contain shrink-0" />
                  : <div className="w-4 h-4 rounded-full bg-brand/30 shrink-0" />}
                <span className="text-text text-[11px] font-bold uppercase tracking-wide truncate">
                  {g.tournamentName}
                </span>
              </div>
              {g.matches.map(m => (
                <MatchRow
                  key={m.id}
                  match={m}
                  pred={predMap.get(m.id)}
                  onTeamClick={(team) => handleTeamClick(team, m, g.tournamentName)}
                  competitionCountry={g.competitionCountry}
                  competitionName={g.tournamentName}
                />
              ))}
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => navigate('/partidos')}
              className="w-full py-2.5 text-brand text-xs font-semibold hover:bg-elevated/50 transition-colors border-t border-border/50"
            >
              Ver todos los partidos de hoy →
            </button>
          )}
        </div>
      )}

      {teamDetail && <TeamDetailSheet {...teamDetail} onClose={closeTeamDetail} />}
    </div>
  )
}
