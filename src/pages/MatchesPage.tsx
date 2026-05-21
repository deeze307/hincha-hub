import { useRef, useState } from 'react'
import { useNavigate }       from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useMatchDate, isSameDay, TODAY, MIN_DATE, MAX_DATE } from '../hooks/useMatchDate'
import { useMatchesForDate, isLive }                          from '../hooks/useMatchesForDate'
import type { TournamentTodayMatches } from '../services/dashboardService'
import type { CompetitionMatch }        from '../services/matchesService'

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

function MatchRow({ match }: { match: CompetitionMatch }) {
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
      <div className="flex items-center gap-2 min-w-0 justify-end">
        <span className="text-text text-sm font-semibold truncate">{match.home_team?.name ?? '—'}</span>
        <TeamLogo url={match.home_team?.logo_url ?? null} name={match.home_team?.name ?? '?'} />
      </div>
      <div className="shrink-0 w-14 text-center">
        {hasResult
          ? <span className={`text-sm font-bold tabular-nums ${live ? 'text-green-400' : 'text-text'}`}>{match.home_score} - {match.away_score}</span>
          : <span className="text-muted-dark text-sm font-semibold">vs</span>}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo url={match.away_team?.logo_url ?? null} name={match.away_team?.name ?? '?'} />
        <span className="text-text text-sm font-semibold truncate">{match.away_team?.name ?? '—'}</span>
      </div>
    </div>
  )
}

// ─── Sección por torneo ───────────────────────────────────────────

function TournamentSection({ group }: { group: TournamentTodayMatches }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-elevated/60 border-b border-border/50">
        {group.competitionLogo
          ? <img src={group.competitionLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
          : <div className="w-5 h-5 rounded-full bg-brand/30 shrink-0" />}
        <span className="text-text text-xs font-bold uppercase tracking-wider truncate">{group.tournamentName}</span>
        <span className="text-muted-dark text-[10px] ml-auto shrink-0">
          {group.matches.length} partido{group.matches.length !== 1 ? 's' : ''}
        </span>
      </div>
      {group.matches.map(m => <MatchRow key={m.id} match={m} />)}
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

  // Cierra al hacer click afuera
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleOutside = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) onClose()
  }
  // Mount/unmount listener
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
      {/* Nav mes */}
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

      {/* Cabecera días */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_ES.map(d => (
          <div key={d} className="text-center text-muted text-[10px] font-semibold py-1">{d}</div>
        ))}
      </div>

      {/* Días */}
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
    = useMatchesForDate(date)

  const [filter, setFilter] = useState<'all' | 'live'>('all')

  const shown = filteredGroups(filter)

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">

      {/* ── Encabezado con Volver ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors shrink-0"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-text text-xl font-semibold tracking-tight">Partidos</h1>
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
            {filter === 'live' ? 'No hay partidos en vivo ahora' : 'No hay partidos este día en tus torneos'}
          </p>
          {!isToday && filter === 'all' && (
            <button onClick={() => setDate(new Date(TODAY))} className="text-brand text-xs font-semibold mt-1 hover:underline">
              Ir a hoy
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map(g => <TournamentSection key={g.tournamentId} group={g} />)}
        </div>
      )}
    </div>
  )
}
