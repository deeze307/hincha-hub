import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchMatchesForDate } from '../../../services/dashboardService'
import type { TournamentTodayMatches } from '../../../services/dashboardService'
import type { CompetitionMatch } from '../../../services/matchesService'

const MAX_PER_COMPETITION = 2
const MAX_COMPETITIONS    = 2   // 2 × 2 = 4 partidos máximo

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

function MatchRow({ match }: { match: CompetitionMatch }) {
  const time = match.match_date
    ? new Date(match.match_date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '—'
  const hasResult = match.home_score != null && match.away_score != null

  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto_1fr] items-center gap-1.5 px-4 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-[11px] font-semibold text-muted-dark text-center shrink-0">{time}</span>
      <div className="flex items-center gap-1.5 min-w-0 justify-end">
        <span className="text-text text-xs font-semibold truncate">{match.home_team?.name ?? '—'}</span>
        <TeamLogo url={match.home_team?.logo_url ?? null} name={match.home_team?.name ?? '?'} />
      </div>
      <div className="shrink-0 w-10 text-center">
        {hasResult
          ? <span className="text-text text-xs font-bold tabular-nums">{match.home_score}-{match.away_score}</span>
          : <span className="text-muted-dark text-[11px]">vs</span>}
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <TeamLogo url={match.away_team?.logo_url ?? null} name={match.away_team?.name ?? '?'} />
        <span className="text-text text-xs font-semibold truncate">{match.away_team?.name ?? '—'}</span>
      </div>
    </div>
  )
}

export default function MatchesCard() {
  const [groups,  setGroups]  = useState<TournamentTodayMatches[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchMatchesForDate(new Date())
      .then(setGroups)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Máximo 2 competiciones, 2 partidos c/u
  const limited = groups
    .slice(0, MAX_COMPETITIONS)
    .map(g => ({ ...g, matches: g.matches.slice(0, MAX_PER_COMPETITION) }))

  const totalToday = groups.reduce((sum, g) => sum + g.matches.length, 0)
  const hasMore    = totalToday > limited.reduce((sum, g) => sum + g.matches.length, 0)

  return (
    <div className="lg:col-span-4 card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Partidos de la fecha</span>
        <button
          onClick={() => navigate('/partidos')}
          className="text-brand text-xs font-semibold hover:underline"
        >
          Ver todos {hasMore && `(+${totalToday - limited.reduce((s, g) => s + g.matches.length, 0)})`}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="text-brand animate-spin" />
        </div>
      ) : limited.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-5 text-center gap-1">
          <span className="text-2xl">📅</span>
          <p className="text-muted text-sm">No hay partidos hoy en tus torneos</p>
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
              {g.matches.map(m => <MatchRow key={m.id} match={m} />)}
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
    </div>
  )
}
