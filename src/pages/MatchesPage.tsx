import { useEffect, useRef, useState } from 'react'
import { useNavigate }       from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, Trophy } from 'lucide-react'
import { teamAbbr } from '../utils/teamUtils'
import { useMatchDate, isSameDay, TODAY, MIN_DATE, MAX_DATE } from '../hooks/useMatchDate'
import { useFeaturedMatchesForDate, isLive }                  from '../hooks/useMatchesForDate'
import { TeamDetailSheet }   from '../components/organisms/TeamDetailSheet'
import { useTeamDetail }     from '../hooks/useTeamDetail'
import { fetchUserPredictionsForMatches } from '../services/predictionsService'
import type { TeamDetailInfo } from '../hooks/useTeamDetail'
import type { FeaturedCompetitionGroup } from '../services/dashboardService'
import type { CompetitionMatch }         from '../services/matchesService'

type TeamRef  = { id: string; name: string; logo_url: string | null }
type MatchPred = { home: number; away: number }

// ─── Constantes ───────────────────────────────────────────────────

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES   = ['LU','MA','MI','JU','VI','SA','DO']

// ─── Logo de equipo ───────────────────────────────────────────────

function TeamLogo({ url, name, size = 24 }: { url: string | null; name: string; size?: number }) {
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

// ─── Fila de partido ──────────────────────────────────────────────

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
    <div className="grid grid-cols-[3.5rem_1fr_auto_1fr] items-center gap-2 px-4 py-3 border-b border-border/30 last:border-0">
      <div className="flex flex-col items-center shrink-0">
        {live
          ? <span className="text-green-400 text-[10px] font-bold uppercase">EN VIVO</span>
          : <span className="text-muted-dark text-[12px] font-semibold">{time}</span>}
      </div>

      {/* Local */}
      <div className="flex items-center gap-1.5 min-w-0 justify-end">
        <button
          type="button"
          onClick={() => match.home_team && onTeamClick?.({ id: match.home_team.id, name: match.home_team.name, logo_url: match.home_team.logo_url ?? null })}
          className="flex items-center gap-2 min-w-0 justify-end hover:opacity-70 transition-opacity"
        >
          <span className="hidden sm:inline text-text text-sm font-semibold truncate">{match.home_team?.name ?? '—'}</span>
          <span className="sm:hidden text-text text-sm font-bold tracking-wide shrink-0">{match.home_team ? teamAbbr(match.home_team.name, competitionCountry, competitionName) : '—'}</span>
          <TeamLogo url={match.home_team?.logo_url ?? null} name={match.home_team?.name ?? '?'} />
        </button>
        {pred != null && (
          <span className="text-brand text-[11px] font-mono tabular-nums shrink-0 font-semibold">{pred.home}</span>
        )}
      </div>

      {/* Marcador central */}
      <div className="shrink-0 w-14 text-center">
        {hasResult
          ? <span className={`text-sm font-bold tabular-nums ${live ? 'text-green-400' : 'text-text'}`}>{match.home_score} - {match.away_score}</span>
          : <span className="text-muted-dark text-sm font-semibold">vs</span>}
      </div>

      {/* Visitante */}
      <div className="flex items-center gap-1.5 min-w-0">
        {pred != null && (
          <span className="text-brand text-[11px] font-mono tabular-nums shrink-0 font-semibold">{pred.away}</span>
        )}
        <button
          type="button"
          onClick={() => match.away_team && onTeamClick?.({ id: match.away_team.id, name: match.away_team.name, logo_url: match.away_team.logo_url ?? null })}
          className="flex items-center gap-2 min-w-0 hover:opacity-70 transition-opacity"
        >
          <TeamLogo url={match.away_team?.logo_url ?? null} name={match.away_team?.name ?? '?'} />
          <span className="hidden sm:inline text-text text-sm font-semibold truncate">{match.away_team?.name ?? '—'}</span>
          <span className="sm:hidden text-text text-sm font-bold tracking-wide shrink-0">{match.away_team ? teamAbbr(match.away_team.name, competitionCountry, competitionName) : '—'}</span>
        </button>
      </div>
    </div>
  )
}

// ─── Sección por competición ──────────────────────────────────────

function CompetitionSection({ group, predMap, openTeamDetail }: {
  group:          FeaturedCompetitionGroup
  predMap:        Map<string, MatchPred>
  openTeamDetail?: (info: TeamDetailInfo) => void
}) {
  const navigate = useNavigate()

  function handleTeamClick(team: TeamRef, m: CompetitionMatch) {
    openTeamDetail?.({
      team,
      competitionId:   m.competition_id,
      seasonYear:      m.season_year,
      competitionName: group.competitionName,
    })
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-elevated/60 border-b border-border/50">
        {group.competitionLogo
          ? <img src={group.competitionLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
          : <div className="w-5 h-5 rounded-full bg-brand/30 shrink-0" />}
        <span className="text-text text-xs font-bold uppercase tracking-wider truncate">{group.competitionName}</span>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {group.isEnrolled ? (
            <span className="px-1.5 py-0.5 bg-brand/20 text-brand text-[9px] font-bold rounded-full border border-brand/30">
              Tu prode
            </span>
          ) : group.joinableTournamentId ? (
            <button
              onClick={() => navigate('/torneos')}
              className="flex items-center gap-1 px-2.5 py-1 bg-brand/10 border border-brand/30 text-brand text-[10px] font-bold rounded-lg hover:bg-brand/20 transition-colors"
            >
              <Trophy size={11} className="shrink-0" />
              Inscribite
            </button>
          ) : null}
          <span className="text-muted-dark text-[10px]">
            {group.matches.length} partido{group.matches.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Partidos */}
      {group.matches.map(m => (
        <MatchRow
          key={m.id}
          match={m}
          pred={group.isEnrolled ? predMap.get(m.id) : undefined}
          onTeamClick={(team) => handleTeamClick(team, m)}
          competitionCountry={group.competitionCountry}
          competitionName={group.competitionName}
        />
      ))}
    </div>
  )
}

// ─── Calendario ───────────────────────────────────────────────────

function MiniCalendar({
  selected, onSelect, onClose,
}: {
  selected: Date
  onSelect: (d: Date) => void
  onClose:  () => void
}) {
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))
  const ref             = useRef<HTMLDivElement>(null)

  const handleOutside = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) onClose()
  }
  useState(() => {
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  })

  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const startDow    = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7

  const cells: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const minView = new Date(MIN_DATE.getFullYear(), MIN_DATE.getMonth(), 1)
  const maxView = new Date(MAX_DATE.getFullYear(), MAX_DATE.getMonth(), 1)
  const curView = new Date(view.getFullYear(), view.getMonth(), 1)

  return (
    <div
      ref={ref}
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-surface border border-border rounded-xl shadow-elevated z-50 p-4 w-72"
    >
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          disabled={curView <= minView}
          className="p-1 rounded-lg hover:bg-elevated disabled:opacity-30 transition-colors text-muted"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-text text-sm">
          {MONTHS_ES[view.getMonth()]} <strong>{view.getFullYear()}</strong>
        </span>
        <button
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          disabled={curView >= maxView}
          className="p-1 rounded-lg hover:bg-elevated disabled:opacity-30 transition-colors text-muted"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS_ES.map(d => (
          <div key={d} className="text-center text-muted text-[10px] font-semibold py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isSel      = isSameDay(day, selected)
          const isToday    = isSameDay(day, TODAY)
          const isDisabled = day < MIN_DATE || day > MAX_DATE
          return (
            <button
              key={i}
              disabled={isDisabled}
              onClick={() => { onSelect(day); onClose() }}
              className={[
                'h-9 w-full flex items-center justify-center rounded-full text-sm transition-colors',
                isSel                               ? 'bg-brand text-white font-bold' : '',
                isToday && !isSel                   ? 'bg-yellow-400/20 text-yellow-400 font-bold' : '',
                isDisabled                          ? 'text-muted/30 cursor-not-allowed' : 'cursor-pointer hover:bg-elevated',
                !isSel && !isToday && !isDisabled   ? 'text-text' : '',
              ].filter(Boolean).join(' ')}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────

export default function MatchesPage() {
  const navigate = useNavigate()

  const { date, setDate, showCalendar, setShowCalendar, goDay, canPrev, canNext, dateLabel, isToday }
    = useMatchDate()

  const { loading, liveCount, filteredGroups }
    = useFeaturedMatchesForDate(date)

  const [filter,  setFilter]  = useState<'all' | 'live'>('all')
  const [predMap, setPredMap] = useState<Map<string, MatchPred>>(new Map())
  const { current: teamDetail, open: openTeamDetail, close: closeTeamDetail } = useTeamDetail()

  useEffect(() => {
    if (loading) return
    const allIds = filteredGroups('all').flatMap(g => g.matches.map(m => m.id))
    if (!allIds.length) { setPredMap(new Map()); return }
    fetchUserPredictionsForMatches(allIds).then(setPredMap).catch(() => {})
  }, [date, loading])

  const shown = filteredGroups(filter)

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">

      {/* ── Encabezado ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors shrink-0"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-text text-xl font-semibold tracking-tight leading-tight">Partidos</h1>
          <p className="text-muted-dark text-[10px]">Competiciones populares · tus torneos siempre incluidos</p>
        </div>
      </div>

      {/* ── Navegador de fecha ── */}
      <div className="card flex items-center">
        <button
          onClick={() => goDay(-1)}
          disabled={!canPrev}
          className="p-3 text-muted hover:text-text disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="relative flex-1 flex justify-center">
          <button
            onClick={() => setShowCalendar(s => !s)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg hover:bg-elevated transition-colors"
          >
            <span className="text-text text-sm font-semibold">{dateLabel}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" className="text-muted fill-current shrink-0">
              <path d="M0 0l5 6 5-6z" />
            </svg>
          </button>

          {showCalendar && (
            <MiniCalendar
              selected={date}
              onSelect={setDate}
              onClose={() => setShowCalendar(false)}
            />
          )}
        </div>

        <button
          onClick={() => goDay(1)}
          disabled={!canNext}
          className="p-3 text-muted hover:text-text disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Tabs Todos / En vivo ── */}
      <div className="flex items-center gap-1 border-b border-border">
        {(['all', 'live'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
              filter === f
                ? f === 'live' ? 'text-green-400 border-green-400' : 'text-brand border-brand'
                : 'text-muted border-transparent hover:text-text',
            ].join(' ')}
          >
            {f === 'all' ? 'Todos' : 'En vivo'}
            {f === 'live' && liveCount > 0 && (
              <span className="bg-green-400/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {liveCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-brand animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <span className="text-3xl">📅</span>
          <p className="text-muted text-sm">
            {filter === 'live'
              ? 'No hay partidos en vivo ahora'
              : 'No hay partidos este día en las competiciones disponibles'}
          </p>
          {!isToday && filter === 'all' && (
            <button onClick={() => setDate(new Date(TODAY))} className="text-brand text-xs font-semibold mt-1 hover:underline">
              Ir a hoy
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map(g => (
            <CompetitionSection
              key={g.competitionId}
              group={g}
              predMap={predMap}
              openTeamDetail={openTeamDetail}
            />
          ))}
        </div>
      )}

      {teamDetail && <TeamDetailSheet {...teamDetail} onClose={closeTeamDetail} />}
    </div>
  )
}
