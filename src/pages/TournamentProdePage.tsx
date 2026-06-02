import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TeamDetailSheet } from '../components/organisms/TeamDetailSheet'
import { useTeamDetail } from '../hooks/useTeamDetail'
import { Loader2, Save, Lock, CheckCircle, ChevronLeft, Search, X, Trophy, Star, Target, Award, Shield, Link2, RefreshCw } from 'lucide-react'
import { fetchTournaments } from '../services/tournamentsService'
import { useAuth } from '../contexts/AuthContext'
import type { BonusType } from '../services/tournamentsService'
import { fetchMatchesByCompetition, groupMatchesByGroup, groupMatchesByRound } from '../services/matchesService'
import {
  fetchUserPredictions, saveMatchPredictions,
  fetchUserBonusPredictions, saveBonusPredictions,
} from '../services/predictionsService'
import { searchTeams, searchPlayers } from '../services/teamsService'
import { createInviteLink } from '../services/inviteService'
import { Toast } from '../components/molecules/Toast'
import type { ToastInfo } from '../components/molecules/Toast'
import { fetchTournamentRanking, fetchUserMatchBreakdown } from '../services/rankingService'
import type { UserMatchBreakdown } from '../services/rankingService'
import type { Tournament } from '../services/tournamentsService'
import { teamAbbr } from '../utils/teamUtils'
import type { CompetitionMatch } from '../services/matchesService'
import type { BonusPrediction } from '../services/predictionsService'
import type { TeamOption, PlayerOption } from '../services/teamsService'
import type { RankingEntry } from '../services/rankingService'

// ─── Tipos locales ────────────────────────────────────────────────

interface ScoreInput {
  home:         string
  away:         string
  home_orig:    string          // valor tal como se cargó/guardó en DB (para detectar cambios reales)
  away_orig:    string
  pts:          number | null  // points_earned from DB after scoring
  is_modified:  boolean        // true = permanently locked (used their one edit)
  exists_in_db: boolean        // false = never saved yet
  predicted_at: string | null  // ISO timestamp of the prediction
}

type PredMap = Map<string, ScoreInput>  // match_id → scores

// ─── Helpers de bloqueo por partido ──────────────────────────────

const LOCKOUT_HOURS = 1   // bloqueo 1h antes del partido
const LATE_HOURS    = 24  // predicciones dentro de 24h → puntos reducidos

function isMatchLocked(match: CompetitionMatch): boolean {
  if (match.home_score != null || match.away_score != null) return true
  if (!match.match_date) return false
  return Date.now() >= new Date(match.match_date).getTime() - LOCKOUT_HOURS * 3_600_000
}

function isMatchLate(match: CompetitionMatch): boolean {
  if (!match.match_date || isMatchLocked(match)) return false
  return Date.now() >= new Date(match.match_date).getTime() - LATE_HOURS * 3_600_000
}

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE', 'INT'])
function isMatchLive(match: CompetitionMatch): boolean {
  return LIVE_STATUSES.has(match.status)
}

// ─── Cálculo de standings (puntos, GD, GF) ───────────────────────

interface TeamStanding {
  teamId:   string
  teamName: string
  logoUrl:  string | null
  pj: number  // partidos jugados (predichos)
  pg: number  // ganados
  pe: number  // empatados
  pp: number  // perdidos
  gf: number  // goles a favor
  gc: number  // goles en contra
  pts: number
}

function calcGroupStandings(
  matches:  CompetitionMatch[],
  predMap:  PredMap,
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>()

  function ensure(_match: CompetitionMatch, team: CompetitionMatch['home_team']) {
    if (!team) return
    if (!standings.has(team.id)) {
      standings.set(team.id, {
        teamId:   team.id,
        teamName: team.name,
        logoUrl:  team.logo_url,
        pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0,
      })
    }
  }

  for (const m of matches) {
    const pred = predMap.get(m.id)
    const homeGoals = pred?.home !== '' && pred?.home !== undefined
      ? parseInt(pred.home) : NaN
    const awayGoals = pred?.away !== '' && pred?.away !== undefined
      ? parseInt(pred.away) : NaN

    if (isNaN(homeGoals) || isNaN(awayGoals)) continue
    if (!m.home_team || !m.away_team) continue

    ensure(m, m.home_team)
    ensure(m, m.away_team)

    const home = standings.get(m.home_team.id)!
    const away = standings.get(m.away_team.id)!

    home.pj++; away.pj++
    home.gf += homeGoals; home.gc += awayGoals
    away.gf += awayGoals; away.gc += homeGoals

    if (homeGoals > awayGoals) {
      home.pg++; home.pts += 3
      away.pp++
    } else if (homeGoals === awayGoals) {
      home.pe++; home.pts++
      away.pe++; away.pts++
    } else {
      away.pg++; away.pts += 3
      home.pp++
    }
  }

  return [...standings.values()].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    const dgA = a.gf - a.gc
    const dgB = b.gf - b.gc
    if (dgB !== dgA) return dgB - dgA
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.teamName.localeCompare(b.teamName)
  })
}

// ─── Componentes ─────────────────────────────────────────────────

function TeamLogo({ url, name, size = 20 }: { url: string | null; name: string; size?: number }) {
  if (url) return <img src={url} alt={name} style={{ width: size, height: size }} className="object-contain shrink-0" />
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-elevated flex items-center justify-center text-[9px] font-bold text-muted shrink-0"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function ScoreBox({
  value, onChange, locked,
}: {
  value: string; onChange: (v: string) => void; locked: boolean
}) {
  const hasPred = locked && value !== ''
  return (
    <input
      type="number" min={0} max={99}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={locked}
      className={`w-9 h-8 text-center text-sm font-semibold bg-elevated border border-border rounded focus:outline-none focus:border-brand disabled:cursor-not-allowed transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
        hasPred ? 'text-orange-400/80' : 'text-text disabled:opacity-40'
      }`}
    />
  )
}

type TeamRef = { id: string; name: string; logo_url: string | null }

function formatPredTime(iso: string): string {
  const d  = new Date(iso)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${hh}:${mm} ${dd}/${mo}`
}

function MatchRow({
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

function GroupStandingsTable({
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

const POSITION_ES: Record<string, string> = {
  'Goalkeeper': 'Arquero',
  'Defender':   'Defensor',
  'Midfielder': 'Mediocampista',
  'Attacker':   'Delantero',
  'Forward':    'Delantero',
}

// ─── Tipos para bonus ─────────────────────────────────────────────

interface SelectedTeam   { id: string; name: string; logo_url: string | null }
interface SelectedPlayer { id: string; name: string; photo_url: string | null; team: string | null }

// ─── Autocomplete equipo ──────────────────────────────────────────

function AutocompleteTeam({
  value, onSelect, locked, teamType, placeholder,
}: {
  value:       SelectedTeam | null
  onSelect:    (t: SelectedTeam | null) => void
  locked:      boolean
  teamType?:   'national' | 'club'
  placeholder: string
}) {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<TeamOption[]>([])
  const [open,      setOpen]      = useState(false)
  const [searching, setSearching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await searchTeams(query, teamType)
        setResults(r)
        setOpen(true)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, teamType])

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-lg border border-border">
        <TeamLogo url={value.logo_url} name={value.name} size={20} />
        <span className="text-text text-sm font-medium flex-1 truncate">{value.name}</span>
        {!locked && (
          <button onClick={() => onSelect(null)} className="text-muted hover:text-text shrink-0">
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-lg border border-border focus-within:border-brand transition-colors">
        <Search size={14} className="text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          disabled={locked}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-muted-dark disabled:opacity-40 disabled:cursor-not-allowed"
        />
        {searching && <Loader2 size={12} className="text-muted animate-spin shrink-0" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-elevated z-20 max-h-48 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              onMouseDown={() => { onSelect({ id: r.id, name: r.name, logo_url: r.logo_url }); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elevated transition-colors text-left"
            >
              <TeamLogo url={r.logo_url} name={r.name} size={18} />
              <span className="text-text text-sm flex-1 truncate">{r.name}</span>
              {r.country && <span className="text-muted text-xs shrink-0">{r.country}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Autocomplete jugador ─────────────────────────────────────────

function AutocompletePlayer({
  value, onSelect, locked, competitionId, placeholder,
}: {
  value:         SelectedPlayer | null
  onSelect:      (p: SelectedPlayer | null) => void
  locked:        boolean
  competitionId: string
  placeholder:   string
}) {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<PlayerOption[]>([])
  const [open,      setOpen]      = useState(false)
  const [searching, setSearching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await searchPlayers(query, competitionId)
        setResults(r)
        setOpen(true)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, competitionId])

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-lg border border-border">
        {value.photo_url
          ? <img src={value.photo_url} alt={value.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
          : <div className="w-6 h-6 rounded-full bg-elevated flex items-center justify-center text-[9px] font-bold text-muted border border-border shrink-0">{value.name.slice(0,2).toUpperCase()}</div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-text text-sm font-medium truncate">{value.name}</p>
          {value.team && <p className="text-muted text-[11px] truncate">{value.team}</p>}
        </div>
        {!locked && (
          <button onClick={() => onSelect(null)} className="text-muted hover:text-text shrink-0">
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-lg border border-border focus-within:border-brand transition-colors">
        <Search size={14} className="text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          disabled={locked}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-muted-dark disabled:opacity-40 disabled:cursor-not-allowed"
        />
        {searching && <Loader2 size={12} className="text-muted animate-spin shrink-0" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-elevated z-20 max-h-48 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              onMouseDown={() => {
                onSelect({ id: r.id, name: r.name, photo_url: r.photo_url, team: (r.team as any)?.name ?? null })
                setQuery('')
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elevated transition-colors text-left"
            >
              {r.photo_url
                ? <img src={r.photo_url} alt={r.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-elevated flex items-center justify-center text-[9px] font-bold text-muted border border-border shrink-0">{r.name.slice(0,2).toUpperCase()}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm truncate">{r.name}</p>
                {(r.team as any)?.name && <p className="text-muted text-[11px] truncate">{(r.team as any).name}</p>}
              </div>
              {r.position && <span className="text-muted text-xs shrink-0">{POSITION_ES[r.position] ?? r.position}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab Bonus ────────────────────────────────────────────────────

const RANK_META = [
  { rank: 1 as const, label: '1ª opción', pts: 10, medal: '🥇' },
  { rank: 2 as const, label: '2ª opción', pts: 5,  medal: '🥈' },
  { rank: 3 as const, label: '3ª opción', pts: 3,  medal: '🥉' },
]

const BONUS_META: Record<BonusType, {
  label: string
  Icon:  React.FC<{ size?: number; className?: string }>
  kind:  'team' | 'player'
}> = {
  champion:        { label: 'Campeón del Torneo',   Icon: Trophy, kind: 'team'   },
  top_scorer:      { label: 'Goleador del Torneo',  Icon: Star,   kind: 'player' },
  top_assists:     { label: 'Asistidor del Torneo', Icon: Target, kind: 'player' },
  mvp:             { label: 'MVP del Torneo',        Icon: Award,  kind: 'player' },
  best_goalkeeper: { label: 'Mejor Arquero',         Icon: Shield, kind: 'player' },
}

interface BonusTabHandle { save: () => Promise<void>; isLocked: boolean }

const BonusTab = forwardRef<BonusTabHandle, { tournament: Tournament; locked: boolean }>(
({ tournament, locked }, ref) => {
  // Bonus types configurados; backwards-compatible con torneos sin bonus_types
  const bonusTypes: BonusType[] = tournament.prode_config?.bonus_types?.length
    ? tournament.prode_config.bonus_types
    : ['champion', 'top_scorer']

  // teamPicks y playerPicks: clave = "type-rank"
  const [teamPicks,       setTeamPicks]       = useState<Record<string, SelectedTeam   | null>>({})
  const [playerPicks,     setPlayerPicks]     = useState<Record<string, SelectedPlayer | null>>({})
  const [savedKeys,       setSavedKeys]       = useState<Set<string>>(new Set())
  const [bonusIsModified, setBonusIsModified] = useState(false)
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const bonuses = await fetchUserBonusPredictions(tournament.id)
        const newTeams:   Record<string, SelectedTeam   | null> = {}
        const newPlayers: Record<string, SelectedPlayer | null> = {}
        const keys = new Set<string>()
        let anyModified = false

        for (const b of bonuses) {
          const key  = `${b.type}-${b.rank}`
          const meta = BONUS_META[b.type as BonusType]
          keys.add(key)
          if (b.is_modified) anyModified = true
          if (meta?.kind === 'team' && b.team_name) {
            newTeams[key] = { id: b.team_id!, name: b.team_name, logo_url: null }
          } else if (meta?.kind === 'player' && b.player_name) {
            newPlayers[key] = { id: b.player_id!, name: b.player_name, photo_url: null, team: null }
          }
        }

        setTeamPicks(newTeams)
        setPlayerPicks(newPlayers)
        setSavedKeys(keys)
        setBonusIsModified(anyModified)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tournament.id])

  const effectiveLocked = locked || bonusIsModified

  const handleSave = useCallback(async () => {
    if (effectiveLocked) return
    const bonuses: BonusPrediction[] = []

    for (const bonusType of bonusTypes) {
      const meta = BONUS_META[bonusType]
      for (const { rank } of RANK_META) {
        const key = `${bonusType}-${rank}`
        if (meta.kind === 'team') {
          const t = teamPicks[key]
          if (!t) continue
          bonuses.push({
            tournament_id: tournament.id,
            type:          bonusType,
            rank,
            team_id:       t.id,
            team_name:     t.name,
            is_modified:   savedKeys.has(key),
          })
        } else {
          const p = playerPicks[key]
          if (!p) continue
          bonuses.push({
            tournament_id: tournament.id,
            type:          bonusType,
            rank,
            player_id:     p.id,
            player_name:   p.name,
            is_modified:   savedKeys.has(key),
          })
        }
      }
    }

    if (bonuses.length === 0) return
    await saveBonusPredictions(tournament.id, bonuses)

    const newSavedKeys = new Set(savedKeys)
    let nowModified = false
    bonuses.forEach(b => {
      const key = `${b.type}-${b.rank}`
      if (b.is_modified) nowModified = true
      newSavedKeys.add(key)
    })
    setSavedKeys(newSavedKeys)
    if (nowModified) setBonusIsModified(true)
  }, [effectiveLocked, teamPicks, playerPicks, savedKeys, tournament.id, bonusTypes])

  useImperativeHandle(ref, () => ({ save: handleSave, isLocked: effectiveLocked }), [handleSave, effectiveLocked])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="text-brand animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Descripción */}
      <div className="bg-brand/10 border border-brand/25 rounded-xl px-4 py-3">
        <p className="text-sm text-text">
          Elegí hasta <span className="font-semibold text-brand">3 opciones</span> por cada premio.
          Si acertás con tu <span className="font-semibold">1ª opción</span> sumás <span className="font-semibold">10 pts</span>, con la <span className="font-semibold">2ª</span> sumás <span className="font-semibold">5 pts</span> y con la <span className="font-semibold">3ª</span> sumás <span className="font-semibold">3 pts</span>.
        </p>
      </div>

      {bonusIsModified && (
        <div className="flex items-center gap-2 text-muted text-sm bg-elevated border border-border rounded-xl px-4 py-3">
          <Lock size={14} className="shrink-0" />
          <span>Ya usaste tu modificación — los bonus no se pueden cambiar más.</span>
        </div>
      )}

      {bonusTypes.map(bonusType => {
        const meta = BONUS_META[bonusType]
        if (!meta) return null
        const needsCompetition = meta.kind === 'player' && !tournament.competition_id
        if (needsCompetition) return null
        const { Icon } = meta

        return (
          <div key={bonusType} className="card">
            <div className="px-4 py-3 border-b border-border bg-elevated/50 rounded-t-[13px] flex items-center gap-2">
              <Icon size={16} className="text-brand" />
              <h3 className="text-text text-sm font-semibold">{meta.label}</h3>
              <span className="text-muted text-xs ml-auto hidden sm:block">si acertás con tu opción</span>
            </div>
            <div className="p-3 space-y-2.5">
              {RANK_META.map(({ rank, label, pts, medal }) => {
                const key = `${bonusType}-${rank}`
                return (
                  <div key={rank} className="flex items-center gap-2 min-w-0">
                    <div className="w-20 shrink-0 flex items-center gap-1.5">
                      <span className="text-lg leading-none">{medal}</span>
                      <div>
                        <p className="text-text text-xs font-semibold">{label}</p>
                        <p className="text-brand text-[11px] font-bold">+{pts} pts</p>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {meta.kind === 'team' ? (
                        <AutocompleteTeam
                          value={teamPicks[key] ?? null}
                          onSelect={t => setTeamPicks(prev => ({ ...prev, [key]: t }))}
                          locked={effectiveLocked}
                          teamType={tournament.team_type}
                          placeholder="Buscar equipo..."
                        />
                      ) : (
                        <AutocompletePlayer
                          value={playerPicks[key] ?? null}
                          onSelect={p => setPlayerPicks(prev => ({ ...prev, [key]: p }))}
                          locked={effectiveLocked}
                          competitionId={tournament.competition_id!}
                          placeholder="Buscar jugador..."
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

    </div>
  )
})

// (TeamDetailSheet moved to src/components/organisms/TeamDetailSheet.tsx)
// ─── Página principal ─────────────────────────────────────────────

export default function TournamentProdePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [tournament,  setTournament]  = useState<Tournament | null>(null)
  const [matches,     setMatches]     = useState<CompetitionMatch[]>([])
  const [predMap,     setPredMap]     = useState<PredMap>(new Map())
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [tab,         setTab]         = useState<'groups' | 'knockout' | 'bonus' | 'ranking'>('groups')
  const [toast,       setToast]       = useState<ToastInfo | null>(null)

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
  }
  const [rankingEntries, setRankingEntries] = useState<RankingEntry[]>([])
  const [rankingLoading, setRankingLoading] = useState(false)
  const myUserId = profile?.id ?? null
  const { current: teamDetail, open: openTeamDetail, close: closeTeamDetail } = useTeamDetail()
  const bonusRef = useRef<BonusTabHandle>(null)

  useEffect(() => {
    if (tab !== 'ranking' || !id) return
    setRankingLoading(true)
    fetchTournamentRanking(id!)
      .then(setRankingEntries)
      .finally(() => setRankingLoading(false))
  }, [tab, id])

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      try {
        const all = await fetchTournaments()
        const t   = all.find(x => x.id === id)
        if (!t || !t.competition_id) { navigate('/torneos'); return }
        setTournament(t)

        const compId     = t.competition_id
        const seasonYear = (t as any).competition?.season_year
          ?? new Date().getFullYear()

        const [ms, preds] = await Promise.all([
          fetchMatchesByCompetition(compId, seasonYear),
          fetchUserPredictions(id!),
        ])

        setMatches(ms)

        // Poblar el map de predicciones
        const map: PredMap = new Map()
        for (const p of preds) {
          const home = p.home_prediction != null ? String(p.home_prediction) : ''
          const away = p.away_prediction != null ? String(p.away_prediction) : ''
          map.set(p.match_id, {
            home,
            away,
            home_orig:    home,
            away_orig:    away,
            pts:          p.points_earned ?? null,
            is_modified:  p.is_modified ?? false,
            exists_in_db: true,
            predicted_at: p.predicted_at ?? null,
          })
        }
        // Inicializar celdas vacías para partidos sin predicción
        for (const m of ms) {
          if (!map.has(m.id)) map.set(m.id, { home: '', away: '', home_orig: '', away_orig: '', pts: null, is_modified: false, exists_in_db: false, predicted_at: null })
        }
        setPredMap(map)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  function handleTeamClick(team: TeamRef) {
    if (!tournament?.competition_id) return
    openTeamDetail({
      team,
      competitionId:   tournament.competition_id,
      seasonYear:      (tournament as any).competition?.season_year ?? new Date().getFullYear(),
      competitionName: tournament.competition?.name ?? null,
    })
  }

  async function refreshMatches() {
    if (!tournament?.competition_id) return
    setRefreshing(true)
    try {
      const seasonYear = (tournament as any).competition?.season_year ?? new Date().getFullYear()
      const ms = await fetchMatchesByCompetition(tournament.competition_id, seasonYear)
      setMatches(ms)
      // Preserve predMap — only add entries for any brand-new match IDs not yet in the map
      setPredMap(prev => {
        const next = new Map(prev)
        for (const m of ms) {
          if (!next.has(m.id)) next.set(m.id, { home: '', away: '', home_orig: '', away_orig: '', pts: null, is_modified: false, exists_in_db: false, predicted_at: null })
        }
        return next
      })
    } finally {
      setRefreshing(false)
    }
  }

  const anyUnlocked = useMemo(
    () => matches.some(m => !isMatchLocked(m) && !(predMap.get(m.id)?.is_modified)),
    [matches, predMap],
  )

  const groupMatchesMap   = useMemo(() => groupMatchesByGroup(matches),  [matches])
  const knockoutRoundsMap = useMemo(() => groupMatchesByRound(matches),  [matches])

  const bonusLocked = useMemo(() => {
    const refMatches = knockoutRoundsMap.get('3rd Place Final') ?? knockoutRoundsMap.get('Final') ?? []
    const refMatch   = refMatches[0]
    if (!refMatch?.match_date) return false
    return Date.now() >= new Date(refMatch.match_date).getTime() - LOCKOUT_HOURS * 3_600_000
  }, [knockoutRoundsMap])

  const config          = tournament?.prode_config
  const isOwner         = tournament?.created_by === myUserId
  const isSuperAdmin    = profile?.role === 'superadmin'
  const canManageAwards = (isOwner || isSuperAdmin) && !!(config?.has_bonus && config?.bonus_types?.length)
  const canInvite       = isOwner || isSuperAdmin
  const directQ  = config?.direct_qualifiers ?? 2
  const bestThird = config?.best_third_count  ?? 0

  const [inviteCopied, setInviteCopied] = useState(false)

  async function handleInvite() {
    if (!id) return
    try {
      const link = await createInviteLink(id)
      await navigator.clipboard.writeText(link)
      setInviteCopied(true)
      setTimeout(() => setInviteCopied(false), 2500)
    } catch {
      // silently ignore clipboard errors
    }
  }

  function setPred(matchId: string, home: string, away: string) {
    setPredMap(prev => {
      const next     = new Map(prev)
      const existing = prev.get(matchId)
      next.set(matchId, {
        home,
        away,
        home_orig:    existing?.home_orig    ?? '',
        away_orig:    existing?.away_orig    ?? '',
        pts:          existing?.pts          ?? null,
        is_modified:  existing?.is_modified  ?? false,
        exists_in_db: existing?.exists_in_db ?? false,
        predicted_at: existing?.predicted_at ?? null,
      })
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    if (!id) return
    setSaving(true)
    try {
      // Guardar predicciones de partido (fase de grupos + eliminatoria)
      const toSave = [...predMap.entries()]
        .filter(([match_id, v]) => {
          if (v.home === '' && v.away === '') return false
          if (v.is_modified) return false
          // Si ya está en DB y el valor no cambió, no reenviar (evita marcarla como "editada")
          if (v.exists_in_db && v.home === v.home_orig && v.away === v.away_orig) return false
          const match = matches.find(m => m.id === match_id)
          return match && !isMatchLocked(match)
        })
        .map(([match_id, v]) => ({
          match_id,
          home:   v.home !== '' ? parseInt(v.home) : null,
          away:   v.away !== '' ? parseInt(v.away) : null,
          is_new: !v.exists_in_db,
        }))

      if (toSave.length) {
        await saveMatchPredictions(id, toSave)
        setPredMap(prev => {
          const next = new Map(prev)
          for (const p of toSave) {
            const existing = prev.get(p.match_id)
            if (!existing) continue
            next.set(p.match_id, {
              ...existing,
              home_orig:    existing.home,
              away_orig:    existing.away,
              exists_in_db: true,
              is_modified:  !p.is_new,
            })
          }
          return next
        })
      }

      // Guardar bonus (siempre, independientemente del tab activo)
      await bonusRef.current?.save()

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      showToast('¡Predicciones guardadas!', 'success')
    } catch (err) {
      console.error('Error guardando bonus:', err)
      showToast('Error al guardar. Intentá de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="text-brand animate-spin" />
      </div>
    )
  }

  if (!tournament) return null

  const tabs = [
    { key: 'groups',   label: 'Grupos' },
    ...(config?.has_knockout ? [{ key: 'knockout', label: 'Eliminatoria' }] : []),
    ...(config?.has_bonus    ? [{ key: 'bonus',    label: 'Bonus' }]       : []),
    { key: 'ranking',  label: 'Ranking' },
  ] as { key: typeof tab; label: string }[]

  // Conteo de predicciones completas en partidos todavía abiertos (todas las fases)
  const unlockedMatches = matches.filter(m => !isMatchLocked(m) && !(predMap.get(m.id)?.is_modified))
  const filledCount     = unlockedMatches.filter(m => {
    const p = predMap.get(m.id)
    return p && p.home !== '' && p.away !== ''
  }).length

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col gap-2">
        {/* Fila 1: back + nombre + premios */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/torneos')}
            className="mt-1 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-text text-xl font-semibold tracking-tight leading-tight">{tournament.name}</h1>
            <p className="text-muted text-sm mt-1">
              {tournament.competition?.name ?? ''} · Prode
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 mt-1 shrink-0">
            {/* Fila 1: refresh + invitar */}
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <button
                  onClick={refreshMatches}
                  disabled={refreshing}
                  title="Actualizar partidos"
                  className="shrink-0 flex items-center justify-center w-8 h-8 text-muted hover:text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                </button>
              )}
              {canInvite && (
                <button
                  onClick={handleInvite}
                  className={`shrink-0 flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-colors ${
                    inviteCopied
                      ? 'text-green-400 border-green-500/40 bg-green-500/10'
                      : 'text-muted hover:text-text bg-elevated hover:bg-elevated/80 border-border'
                  }`}
                >
                  <Link2 size={13} />
                  {inviteCopied ? '¡Copiado!' : 'Invitar'}
                </button>
              )}
            </div>
            {/* Fila 2: premios */}
            {canManageAwards && (
              <button
                onClick={() => navigate(`/torneos/${id}/premios`)}
                className="shrink-0 flex items-center gap-1.5 text-xs text-muted hover:text-text bg-elevated hover:bg-elevated/80 border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                <Trophy size={13} /> Premios
              </button>
            )}
          </div>
        </div>

        {/* Fila 2: estado / acciones */}
        {tab !== 'ranking' && (
          <div className="flex items-center justify-between gap-3 pl-11">
            {!anyUnlocked && tab !== 'bonus' ? (
              <div className="flex items-center gap-2 text-muted text-sm">
                <Lock size={14} />
                <span>Predicciones cerradas</span>
              </div>
            ) : (
              <>
                <span className="text-muted text-xs">
                  {tab === 'bonus'
                    ? 'Campeón, goleador y más'
                    : `${filledCount}/${unlockedMatches.length} partidos cargados`
                  }
                </span>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 shrink-0"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
                  {saved ? 'Guardado' : 'Guardar todo'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Info de puntuación */}
      <ScoringInfoBanner />

      {/* Tabs */}
      <div className="flex gap-1 bg-elevated p-1 rounded-md w-full sm:w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-1.5 rounded-[8px] text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              tab === t.key ? 'bg-brand text-white' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Fase de Grupos ── */}
      {tab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...groupMatchesMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([groupName, gMatches]) => {
            const standings = calcGroupStandings(gMatches, predMap)
            return (
              <div key={groupName} className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-elevated/50">
                  <h3 className="text-text text-sm font-semibold">{groupName || 'Grupo'}</h3>
                </div>
                <div className="px-4">
                  {gMatches.map(m => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      pred={predMap.get(m.id) ?? { home: '', away: '', home_orig: '', away_orig: '', pts: null, is_modified: false, exists_in_db: false, predicted_at: null }}
                      onChange={(h, a) => setPred(m.id, h, a)}
                      onTeamClick={handleTeamClick}
                      competitionCountry={tournament?.competition?.country ?? ''}
                      competitionName={tournament?.competition?.name ?? ''}
                    />
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <GroupStandingsTable
                    standings={standings}
                    qualifiers={directQ}
                    showBestThird={bestThird > 0}
                  />
                </div>
              </div>
            )
          })}

          {groupMatchesMap.size === 0 && (
            <div className="col-span-2 card p-12 text-center text-muted">
              No hay partidos de fase de grupos cargados aún.
              <p className="text-xs text-muted-dark mt-2">
                Ejecutá la función <code>sync-fixtures</code> desde Supabase para cargarlos.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Eliminatoria ── */}
      {tab === 'knockout' && (
        <KnockoutTab
          roundsMap={knockoutRoundsMap}
          predMap={predMap}
          onPred={setPred}
          onTeamClick={handleTeamClick}
          competitionCountry={tournament?.competition?.country ?? ''}
          competitionName={tournament?.competition?.name ?? ''}
        />
      )}

      {/* ── Bonus — siempre montado para que bonusRef esté disponible en handleSave ── */}
      {config?.has_bonus && (
        <div className={tab !== 'bonus' ? 'hidden' : ''}>
          <BonusTab ref={bonusRef} tournament={tournament} locked={bonusLocked} />
        </div>
      )}

      {/* ── Ranking ── */}
      {tab === 'ranking' && (
        <ProdeRankingTab
          entries={rankingEntries}
          loading={rankingLoading}
          myUserId={myUserId}
          tournamentId={id!}
        />
      )}

      {/* ── Team detail sheet / modal ── */}
      {teamDetail && (
        <TeamDetailSheet {...teamDetail} onClose={closeTeamDetail} />
      )}

      {/* ── Toast ── */}
      {toast && <Toast info={toast} onDismiss={() => setToast(null)} />}

    </div>
  )
}

// ─── Player points sheet ──────────────────────────────────────────

interface PlayerSheetInfo {
  userId:      string
  displayName: string
  avatarUrl:   string | null
  totalPts:    number
  matchPts:    number
  bonusPts:    number
}

function PlayerPointsSheet({
  info, tournamentId, onClose,
}: {
  info:         PlayerSheetInfo
  tournamentId: string
  onClose:      () => void
}) {
  const [entered, setEntered] = useState(false)
  const [closing, setClosing] = useState(false)
  const [dragY,   setDragY]   = useState(0)
  const startYRef = useRef(0)
  const dragging  = useRef(false)
  const [items,   setItems]   = useState<UserMatchBreakdown[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    fetchUserMatchBreakdown(tournamentId, info.userId)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tournamentId, info.userId])

  function handleClose() { setClosing(true); setTimeout(onClose, 300) }
  function onTouchStart(e: React.TouchEvent) { startYRef.current = e.touches[0].clientY; dragging.current = true }
  function onTouchMove(e: React.TouchEvent)  { if (!dragging.current) return; const d = e.touches[0].clientY - startYRef.current; if (d > 0) setDragY(d) }
  function onTouchEnd()                      { dragging.current = false; if (dragY > 80) handleClose(); else setDragY(0) }

  const sheetStyle = closing
    ? { transform: 'translateY(100%)', transition: 'transform 0.3s ease-in' }
    : dragY > 0
    ? { transform: `translateY(${dragY}px)`, transition: 'none' }
    : entered
    ? { transform: 'translateY(0)',    transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1)' }
    : { transform: 'translateY(100%)', transition: 'none' }

  const modalStyle = {
    opacity:    entered && !closing ? 1 : 0,
    transform:  entered && !closing ? 'scale(1)' : 'scale(0.97)',
    transition: entered ? 'all 0.2s ease-out' : 'none',
  }

  const initials = info.displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  function SheetTeamLogo({ url, name }: { url: string | null; name: string }) {
    if (url) return <img src={url} alt={name} className="w-5 h-5 object-contain shrink-0" />
    return (
      <div className="w-5 h-5 rounded-full bg-elevated flex items-center justify-center text-[9px] font-bold text-muted shrink-0 border border-border">
        {name.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  function formatMatchDate(iso: string | null) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  }

  function SheetContent() {
    return (
      <>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          {info.avatarUrl
            ? <img src={info.avatarUrl} alt={info.displayName} className="w-10 h-10 rounded-full object-cover shrink-0" />
            : <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
                <span className="text-brand text-sm font-bold">{initials}</span>
              </div>
          }
          <div className="flex-1 min-w-0">
            <h2 className="text-text text-base font-bold leading-tight truncate">{info.displayName}</h2>
            <p className="text-muted text-xs mt-0.5">
              {info.matchPts} pts partidos · {info.bonusPts} pts bonus ·{' '}
              <span className="text-text font-semibold">{info.totalPts} total</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-muted hover:text-text p-1 rounded-lg hover:bg-elevated transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="text-brand animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
            <span className="text-2xl">📊</span>
            <p className="text-muted text-sm">No hay partidos puntuados aún.</p>
          </div>
        ) : (
          <>
            <p className="text-muted-dark text-[10px] font-semibold uppercase tracking-wider px-4 py-2 border-b border-border/50 shrink-0">
              {items.length} partido{items.length !== 1 ? 's' : ''} puntuado{items.length !== 1 ? 's' : ''}
            </p>
            <div className="relative overflow-hidden flex-1" style={{ minHeight: 0 }}>
              <div className="overflow-y-auto h-full" style={{ maxHeight: '55vh' }}>
                {items.map(item => (
                  <div key={item.matchId} className="px-4 py-3 border-b border-border/30 last:border-0">
                    {/* Equipos + marcador + predicción */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="flex items-center gap-1.5 justify-end min-w-0">
                        <span className="text-text text-xs font-semibold truncate text-right">{item.homeTeamName}</span>
                        <SheetTeamLogo url={item.homeTeamLogo} name={item.homeTeamName} />
                      </div>
                      <div className="flex flex-col items-center shrink-0">
                        <span className="text-text text-xs font-bold tabular-nums">{item.homeScore}–{item.awayScore}</span>
                        <span className="text-orange-400/80 text-[10px] font-mono tabular-nums leading-tight">{item.homePred}–{item.awayPred}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <SheetTeamLogo url={item.awayTeamLogo} name={item.awayTeamName} />
                        <span className="text-text text-xs font-semibold truncate">{item.awayTeamName}</span>
                      </div>
                    </div>
                    {/* Fecha + puntos */}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-muted-dark text-[10px]">{formatMatchDate(item.matchDate)}</span>
                      <div className="flex items-center gap-2">
                        {item.isHalf && (
                          <span className="text-yellow-400 text-[10px] font-semibold">½ pts</span>
                        )}
                        <span className={`text-xs font-bold tabular-nums ${
                          item.pointsEarned >= 8 ? 'text-green-400' :
                          item.pointsEarned >= 3 ? 'text-yellow-400' : 'text-orange-400'
                        }`}>+{item.pointsEarned}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Gradiente para indicar que hay más contenido scrolleable */}
              {items.length > 3 && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-surface to-transparent" />
              )}
            </div>
            {/* Total al pie */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-elevated/40 shrink-0">
              <span className="text-muted text-xs">Total partidos</span>
              <span className="text-text text-sm font-bold tabular-nums">
                {items.reduce((s, i) => s + i.pointsEarned, 0)} pts
              </span>
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        style={{ opacity: entered && !closing ? 1 : 0, transition: 'opacity 0.3s' }}
      />
      {/* Mobile: bottom sheet */}
      <div
        className="sm:hidden relative w-full bg-surface rounded-t-2xl shadow-elevated overflow-hidden"
        style={sheetStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <SheetContent />
      </div>
      {/* Desktop: modal centrado */}
      <div
        className="hidden sm:block relative w-full max-w-md bg-surface rounded-2xl shadow-elevated overflow-hidden mx-4"
        style={modalStyle}
      >
        <SheetContent />
      </div>
    </div>
  )
}

// ─── Ranking tab (inline) ─────────────────────────────────────────

function RankingAvatar({ url, name }: { url: string | null; name: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  if (url) return <img src={url} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />
  return (
    <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
      <span className="text-brand text-[11px] font-bold">{initials}</span>
    </div>
  )
}

function medalFor(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

function ProdeRankingTab({
  entries, loading, myUserId, tournamentId,
}: {
  entries:      RankingEntry[]
  loading:      boolean
  myUserId:     string | null
  tournamentId: string
}) {
  const [selectedUser, setSelectedUser] = useState<PlayerSheetInfo | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="text-brand animate-spin" />
      </div>
    )
  }

  if (!entries.length) {
    return <p className="text-muted text-sm text-center py-12">Aún no hay participantes con predicciones.</p>
  }

  return (
    <>
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2rem_1fr_3.5rem] sm:grid-cols-[2rem_1fr_4.5rem_4rem_4rem] gap-2 px-4 py-2.5 border-b border-border bg-elevated/60">
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest">#</span>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest">Jugador</span>
          <span className="hidden sm:block text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Partidos</span>
          <span className="hidden sm:block text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Bonus</span>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Total</span>
        </div>

        {entries.map((entry, idx) => {
          const isMe      = entry.userId === myUserId
          const medal     = entry.rank > 0 ? medalFor(entry.rank) : ''
          const rankLabel = entry.rank > 0 ? (medal || `#${entry.rank}`) : '—'

          const rowContent = (
            <>
              <span className={`text-sm font-bold leading-none ${isMe ? 'text-brand' : 'text-muted'}`}>
                {rankLabel}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                <RankingAvatar url={entry.avatarUrl} name={entry.displayName} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate leading-tight ${isMe ? 'text-brand' : 'text-text'}`}>
                    {entry.displayName}
                    {isMe && <span className="text-[10px] ml-1 opacity-60">(vos)</span>}
                  </p>
                  <p className="text-muted-dark text-[10px] mt-0.5">
                    {entry.matchesScored} result.
                    <span className="sm:hidden"> · {entry.matchPts}+{entry.bonusPts} pts</span>
                  </p>
                </div>
              </div>
              <span className="hidden sm:block text-text text-sm font-semibold text-right">{entry.matchPts}</span>
              <span className="hidden sm:block text-text text-sm font-semibold text-right">{entry.bonusPts}</span>
              <span className={`text-sm font-bold text-right ${isMe ? 'text-brand' : 'text-text'}`}>
                {entry.totalPts}
              </span>
            </>
          )

          const rowClass = [
            'w-full text-left grid grid-cols-[2rem_1fr_3.5rem] sm:grid-cols-[2rem_1fr_4.5rem_4rem_4rem] gap-2 px-4 py-3 items-center',
            idx < entries.length - 1 ? 'border-b border-border/50' : '',
            isMe ? 'bg-brand/5' : '',
          ].join(' ')

          return isMe ? (
            <button
              key={entry.userId}
              type="button"
              onClick={() => setSelectedUser({
                userId:      entry.userId,
                displayName: entry.displayName,
                avatarUrl:   entry.avatarUrl,
                totalPts:    entry.totalPts,
                matchPts:    entry.matchPts,
                bonusPts:    entry.bonusPts,
              })}
              className={`${rowClass} hover:bg-brand/10 transition-colors`}
            >
              {rowContent}
            </button>
          ) : (
            <div key={entry.userId} className={rowClass}>
              {rowContent}
            </div>
          )
        })}
      </div>

      {selectedUser && (
        <PlayerPointsSheet
          info={selectedUser}
          tournamentId={tournamentId}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  )
}

// ─── Banner de sistema de puntos ─────────────────────────────────

function ScoringInfoBanner() {
  const rows: [string, number, number][] = [
    ['Resultado exacto',          12, 6],
    ['Ganador + goles de 1 equipo', 8, 4],
    ['Solo ganador / empate',       6, 3],
    ['Goles de un equipo',          2, 1],
  ]
  return (
    <div className="bg-elevated border border-border rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-muted-dark text-[11px] font-semibold uppercase tracking-wider">Puntos por predicción</p>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-green-400 font-semibold">● ≥ 24h antes</span>
          <span className="text-yellow-400 font-semibold">● &lt; 24h antes</span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
        {rows.map(([label, early, late]) => (
          <div key={label} className="contents">
            <span className="text-muted text-xs">{label}</span>
            <span className="text-green-400 text-xs font-bold text-right">+{early}</span>
            <span className="text-yellow-400 text-xs font-bold text-right">+{late}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab Eliminatoria ─────────────────────────────────────────────

function KnockoutTab({
  roundsMap, predMap, onPred, onTeamClick, competitionCountry, competitionName,
}: {
  roundsMap:           Map<string, CompetitionMatch[]>
  predMap:             PredMap
  onPred:              (matchId: string, home: string, away: string) => void
  onTeamClick?:        (team: TeamRef) => void
  competitionCountry?: string
  competitionName?:    string
}) {
  if (roundsMap.size === 0) {
    return (
      <div className="card p-12 text-center text-muted">
        <p className="text-sm">Los partidos eliminatorios se cargarán cuando estén disponibles.</p>
      </div>
    )
  }

  const ROUND_LABELS: Record<string, string> = {
    'Round of 32':    '16avos de Final',
    'Round of 16':    'Octavos de Final',
    'Quarter-finals': 'Cuartos de Final',
    'Semi-finals':    'Semifinales',
    '3rd Place Final':'Tercer Puesto',
    'Final':          'Final',
  }

  return (
    <div className="space-y-5">
      {[...roundsMap.entries()]
        .sort(([, a], [, b]) => (a[0]?.round_order ?? 0) - (b[0]?.round_order ?? 0))
        .map(([round, rMatches]) => (
          <div key={round} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-elevated/50">
              <h3 className="text-text text-sm font-semibold">
                {ROUND_LABELS[round] ?? round}
              </h3>
            </div>
            <div className="px-4">
              {rMatches
                .sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0))
                .map(m => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    pred={predMap.get(m.id) ?? { home: '', away: '', home_orig: '', away_orig: '', pts: null, is_modified: false, exists_in_db: false, predicted_at: null }}
                    onChange={(h, a) => onPred(m.id, h, a)}
                    onTeamClick={onTeamClick}
                    competitionCountry={competitionCountry}
                    competitionName={competitionName}
                  />
                ))
              }
            </div>
          </div>
        ))
      }
    </div>
  )
}
