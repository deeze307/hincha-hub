import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Save, Lock, CheckCircle, ChevronLeft, Search, X, Trophy, Star } from 'lucide-react'
import { fetchTournaments } from '../services/tournamentsService'
import { fetchMatchesByCompetition, groupMatchesByGroup, groupMatchesByRound } from '../services/matchesService'
import {
  fetchUserPredictions, saveMatchPredictions,
  fetchUserBonusPredictions, saveBonusPredictions,
} from '../services/predictionsService'
import { searchTeams, searchPlayers } from '../services/teamsService'
import { fetchTournamentRanking } from '../services/rankingService'
import { supabase } from '../lib/supabase'
import type { Tournament } from '../services/tournamentsService'
import type { CompetitionMatch } from '../services/matchesService'
import type { BonusPrediction } from '../services/predictionsService'
import type { TeamOption, PlayerOption } from '../services/teamsService'
import type { RankingEntry } from '../services/rankingService'

// ─── Tipos locales ────────────────────────────────────────────────

interface ScoreInput {
  home:         string
  away:         string
  pts:          number | null  // points_earned from DB after scoring
  is_modified:  boolean        // true = permanently locked (used their one edit)
  exists_in_db: boolean        // false = never saved yet
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
  return (
    <input
      type="number" min={0} max={99}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={locked}
      className="w-10 h-9 text-center text-sm font-semibold text-text bg-elevated border border-border rounded-lg focus:outline-none focus:border-brand disabled:opacity-40 disabled:cursor-not-allowed transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  )
}

function MatchRow({
  match, pred, onChange,
}: {
  match:    CompetitionMatch
  pred:     ScoreInput
  onChange: (home: string, away: string) => void
}) {
  const locked = isMatchLocked(match) || pred.is_modified
  const isLate = isMatchLate(match)
  const isPast = match.home_score != null ||
    (match.match_date != null && new Date(match.match_date) < new Date())

  const displayPts = (match.home_score != null && match.away_score != null) ? pred.pts : null

  const dateStr = match.match_date
    ? new Date(match.match_date).toLocaleString('es-AR', {
        weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—'

  return (
    <div className={`flex items-center gap-3 px-3 py-3 border-b border-border/40 last:border-0 ${
      isPast ? 'bg-black/20' : isLate ? 'bg-yellow-500/5' : ''
    }`}>
      {/* Equipo local */}
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <span className={`text-sm font-medium truncate text-right hidden sm:block ${isPast ? 'text-muted' : 'text-text'}`}>
          {match.home_team?.name ?? '—'}
        </span>
        <TeamLogo url={match.home_team?.logo_url ?? null} name={match.home_team?.name ?? '?'} />
      </div>

      {/* Inputs + indicador ½ pts */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <ScoreBox value={pred.home} onChange={v => onChange(v, pred.away)} locked={locked} />
          <span className="text-muted-dark text-xs font-semibold">-</span>
          <ScoreBox value={pred.away} onChange={v => onChange(pred.home, v)} locked={locked} />
        </div>
        {isLate && (
          <span className="text-yellow-400 text-[10px] font-semibold leading-none">½ pts</span>
        )}
      </div>

      {/* Equipo visitante */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <TeamLogo url={match.away_team?.logo_url ?? null} name={match.away_team?.name ?? '?'} />
        <span className={`text-sm font-medium truncate hidden sm:block ${isPast ? 'text-muted' : 'text-text'}`}>
          {match.away_team?.name ?? '—'}
        </span>
      </div>

      {/* Resultado real + pts */}
      <div className="shrink-0 w-20 text-right">
        {match.home_score != null && match.away_score != null ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-muted-dark text-xs font-mono">
              {match.home_score} - {match.away_score}
            </span>
            {displayPts != null && (
              <span className={`text-[11px] font-bold ${
                displayPts >= 8 ? 'text-green-400' :
                displayPts >= 3 ? 'text-yellow-400' :
                displayPts >  0 ? 'text-orange-400' :
                'text-red-400'
              }`}>
                +{displayPts}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-dark text-[11px]">{dateStr}</span>
        )}
      </div>
    </div>
  )
}

function GroupStandingsTable({
  standings, qualifiers, showBestThird,
}: {
  standings:     TeamStanding[]
  qualifiers:    number
  showBestThird: boolean
}) {
  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-border/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-elevated">
            <th className="px-2 py-1.5 text-left text-muted font-semibold w-5">#</th>
            <th className="px-2 py-1.5 text-left text-muted font-semibold">Equipo</th>
            <th className="px-2 py-1.5 text-center text-muted font-semibold">PJ</th>
            <th className="px-2 py-1.5 text-center text-muted font-semibold">PG</th>
            <th className="px-2 py-1.5 text-center text-muted font-semibold">PE</th>
            <th className="px-2 py-1.5 text-center text-muted font-semibold">PP</th>
            <th className="px-2 py-1.5 text-center text-muted font-semibold">GD</th>
            <th className="px-2 py-1.5 text-center text-muted font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const isQ = i < qualifiers
            const is3rd = !isQ && i === qualifiers
            return (
              <tr
                key={s.teamId}
                className={`border-t border-border/30 ${
                  isQ ? 'bg-green-500/5' : is3rd && showBestThird ? 'bg-yellow-500/5' : ''
                }`}
              >
                <td className="px-2 py-1.5 text-center">
                  <span className={`text-[10px] font-bold ${
                    isQ ? 'text-green-400' : is3rd && showBestThird ? 'text-yellow-400' : 'text-muted'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <TeamLogo url={s.logoUrl} name={s.teamName} size={14} />
                    <span className="text-text font-medium truncate max-w-24">{s.teamName}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center text-muted">{s.pj}</td>
                <td className="px-2 py-1.5 text-center text-muted">{s.pg}</td>
                <td className="px-2 py-1.5 text-center text-muted">{s.pe}</td>
                <td className="px-2 py-1.5 text-center text-muted">{s.pp}</td>
                <td className="px-2 py-1.5 text-center text-muted">
                  {s.pj > 0 ? (s.gf - s.gc > 0 ? '+' : '') + (s.gf - s.gc) : '—'}
                </td>
                <td className="px-2 py-1.5 text-center font-bold text-text">{s.pts}</td>
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

function BonusTab({ tournament, locked }: { tournament: Tournament; locked: boolean }) {
  const [champions,        setChampions]        = useState<[SelectedTeam|null, SelectedTeam|null, SelectedTeam|null]>([null, null, null])
  const [scorers,          setScorers]          = useState<[SelectedPlayer|null, SelectedPlayer|null, SelectedPlayer|null]>([null, null, null])
  const [savedKeys,        setSavedKeys]        = useState<Set<string>>(new Set())
  const [bonusIsModified,  setBonusIsModified]  = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [saved,            setSaved]            = useState(false)
  const [loading,          setLoading]          = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const bonuses = await fetchUserBonusPredictions(tournament.id)
        const newChamps: [SelectedTeam|null, SelectedTeam|null, SelectedTeam|null]         = [null, null, null]
        const newScores: [SelectedPlayer|null, SelectedPlayer|null, SelectedPlayer|null]   = [null, null, null]
        const keys = new Set<string>()
        let anyModified = false
        for (const b of bonuses) {
          keys.add(`${b.type}-${b.rank}`)
          if (b.is_modified) anyModified = true
          if (b.type === 'champion' && b.rank >= 1 && b.rank <= 3 && b.team_name) {
            newChamps[b.rank - 1] = { id: b.team_id!, name: b.team_name, logo_url: null }
          }
          if (b.type === 'top_scorer' && b.rank >= 1 && b.rank <= 3 && b.player_name) {
            newScores[b.rank - 1] = { id: b.player_id!, name: b.player_name, photo_url: null, team: null }
          }
        }
        setChampions(newChamps)
        setScorers(newScores)
        setSavedKeys(keys)
        setBonusIsModified(anyModified)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tournament.id])

  // Effective lock: time-locked by parent OR already used their one modification
  const effectiveLocked = locked || bonusIsModified

  async function handleSave() {
    if (effectiveLocked) return
    setSaving(true)
    try {
      const bonuses: BonusPrediction[] = []
      champions.forEach((c, i) => {
        if (!c) return
        const key = `champion-${i + 1}`
        bonuses.push({
          tournament_id: tournament.id,
          type:          'champion',
          rank:          (i + 1) as 1|2|3,
          team_id:       c.id,
          team_name:     c.name,
          is_modified:   savedKeys.has(key),  // true = this is a modification of an existing row
        })
      })
      scorers.forEach((s, i) => {
        if (!s) return
        const key = `top_scorer-${i + 1}`
        bonuses.push({
          tournament_id: tournament.id,
          type:          'top_scorer',
          rank:          (i + 1) as 1|2|3,
          player_id:     s.id,
          player_name:   s.name,
          is_modified:   savedKeys.has(key),
        })
      })
      if (bonuses.length === 0) return
      await saveBonusPredictions(tournament.id, bonuses)

      // Update local state to reflect what was saved
      const newSavedKeys = new Set(savedKeys)
      let nowModified = false
      bonuses.forEach(b => {
        const key = `${b.type}-${b.rank}`
        if (b.is_modified) nowModified = true
        newSavedKeys.add(key)
      })
      setSavedKeys(newSavedKeys)
      if (nowModified) setBonusIsModified(true)

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

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
          Elegí hasta <span className="font-semibold text-brand">3 opciones</span> para el campeón y el goleador del torneo.
          Si acertás con tu <span className="font-semibold">1ª opción</span> sumás <span className="font-semibold">10 pts</span>, con la <span className="font-semibold">2ª</span> sumás <span className="font-semibold">5 pts</span> y con la <span className="font-semibold">3ª</span> sumás <span className="font-semibold">3 pts</span>.
        </p>
      </div>

      {/* Estado modificado */}
      {bonusIsModified && (
        <div className="flex items-center gap-2 text-muted text-sm bg-elevated border border-border rounded-xl px-4 py-3">
          <Lock size={14} className="shrink-0" />
          <span>Ya usaste tu modificación — los bonus no se pueden cambiar más.</span>
        </div>
      )}

      {/* Campeón */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border bg-elevated/50 rounded-t-[13px] flex items-center gap-2">
          <Trophy size={16} className="text-brand" />
          <h3 className="text-text text-sm font-semibold">Campeón del Torneo</h3>
          <span className="text-muted text-xs ml-auto">si acertás con tu opción</span>
        </div>
        <div className="p-4 space-y-3">
          {RANK_META.map(({ rank, label, pts, medal }) => (
            <div key={rank} className="flex items-center gap-3">
              <div className="w-28 shrink-0 flex items-center gap-1.5">
                <span className="text-lg leading-none">{medal}</span>
                <div>
                  <p className="text-text text-xs font-semibold">{label}</p>
                  <p className="text-brand text-[11px] font-bold">+{pts} pts</p>
                </div>
              </div>
              <div className="flex-1">
                <AutocompleteTeam
                  value={champions[rank - 1]}
                  onSelect={t => setChampions(prev => {
                    const next = [...prev] as typeof prev
                    next[rank - 1] = t
                    return next
                  })}
                  locked={effectiveLocked}
                  teamType={tournament.team_type}
                  placeholder="Buscar equipo..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goleador */}
      {tournament.competition_id && (
        <div className="card">
          <div className="px-4 py-3 border-b border-border bg-elevated/50 rounded-t-[13px] flex items-center gap-2">
            <Star size={16} className="text-brand" />
            <h3 className="text-text text-sm font-semibold">Goleador del Torneo</h3>
            <span className="text-muted text-xs ml-auto">si acertás con tu opción</span>
          </div>
          <div className="p-4 space-y-3">
            {RANK_META.map(({ rank, label, pts, medal }) => (
              <div key={rank} className="flex items-center gap-3">
                <div className="w-28 shrink-0 flex items-center gap-1.5">
                  <span className="text-lg leading-none">{medal}</span>
                  <div>
                    <p className="text-text text-xs font-semibold">{label}</p>
                    <p className="text-brand text-[11px] font-bold">+{pts} pts</p>
                  </div>
                </div>
                <div className="flex-1">
                  <AutocompletePlayer
                    value={scorers[rank - 1]}
                    onSelect={p => setScorers(prev => {
                      const next = [...prev] as typeof prev
                      next[rank - 1] = p
                      return next
                    })}
                    locked={effectiveLocked}
                    competitionId={tournament.competition_id!}
                    placeholder="Buscar jugador..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guardar */}
      {!effectiveLocked && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saved ? 'Guardado' : 'Guardar Bonus'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────

export default function TournamentProdePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches,    setMatches]    = useState<CompetitionMatch[]>([])
  const [predMap,    setPredMap]    = useState<PredMap>(new Map())
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [tab,        setTab]        = useState<'groups' | 'knockout' | 'bonus' | 'ranking'>('groups')
  const [rankingEntries, setRankingEntries] = useState<RankingEntry[]>([])
  const [rankingLoading, setRankingLoading] = useState(false)
  const [myUserId,   setMyUserId]   = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null))
  }, [])

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
          map.set(p.match_id, {
            home:         p.home_prediction != null ? String(p.home_prediction) : '',
            away:         p.away_prediction != null ? String(p.away_prediction) : '',
            pts:          p.points_earned ?? null,
            is_modified:  p.is_modified ?? false,
            exists_in_db: true,
          })
        }
        // Inicializar celdas vacías para partidos sin predicción
        for (const m of ms) {
          if (!map.has(m.id)) map.set(m.id, { home: '', away: '', pts: null, is_modified: false, exists_in_db: false })
        }
        setPredMap(map)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

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

  const config = tournament?.prode_config
  const directQ  = config?.direct_qualifiers ?? 2
  const bestThird = config?.best_third_count  ?? 0

  function setPred(matchId: string, home: string, away: string) {
    setPredMap(prev => {
      const next     = new Map(prev)
      const existing = prev.get(matchId)
      next.set(matchId, {
        home,
        away,
        pts:          existing?.pts          ?? null,
        is_modified:  existing?.is_modified  ?? false,
        exists_in_db: existing?.exists_in_db ?? false,
      })
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    if (!id) return
    setSaving(true)
    try {
      const toSave = [...predMap.entries()]
        .filter(([match_id, v]) => {
          if (v.home === '' && v.away === '') return false
          if (v.is_modified) return false  // already used their one edit — skip
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
        // Update predMap: new entries get exists_in_db=true; updated entries get is_modified=true
        setPredMap(prev => {
          const next = new Map(prev)
          for (const p of toSave) {
            const existing = prev.get(p.match_id)
            if (!existing) continue
            next.set(p.match_id, {
              ...existing,
              exists_in_db: true,
              is_modified:  !p.is_new,  // only mark modified if it was an update
            })
          }
          return next
        })
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
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
    { key: 'groups',   label: 'Fase de Grupos' },
    ...(config?.has_knockout ? [{ key: 'knockout', label: 'Eliminatoria' }] : []),
    ...(config?.has_bonus    ? [{ key: 'bonus',    label: 'Bonus' }]       : []),
    { key: 'ranking',  label: 'Ranking' },
  ] as { key: typeof tab; label: string }[]

  // Conteo de predicciones completas en partidos todavía abiertos
  const groupMatches        = matches.filter(m => m.round_order === 1)
  const unlockedGroupMatches = groupMatches.filter(m => !isMatchLocked(m))
  const filledCount         = unlockedGroupMatches.filter(m => {
    const p = predMap.get(m.id)
    return p && p.home !== '' && p.away !== ''
  }).length

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col gap-2">
        {/* Fila 1: back + nombre */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/torneos')}
            className="mt-1 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-text text-xl font-semibold tracking-tight leading-tight">{tournament.name}</h1>
            <p className="text-muted text-sm mt-1">
              {tournament.competition?.name ?? ''} · Prode
            </p>
          </div>
        </div>

        {/* Fila 2: estado / acciones */}
        <div className="flex items-center justify-between gap-3 pl-11">
          {!anyUnlocked ? (
            <div className="flex items-center gap-2 text-muted text-sm">
              <Lock size={14} />
              <span>Predicciones cerradas</span>
            </div>
          ) : (
            <>
              <span className="text-muted text-xs">
                {filledCount}/{unlockedGroupMatches.length} partidos por jugar
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 shrink-0"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : saved ? (
                  <CheckCircle size={14} />
                ) : (
                  <Save size={14} />
                )}
                {saved ? 'Guardado' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info de puntuación */}
      <ScoringInfoBanner />

      {/* Tabs */}
      <div className="flex gap-1 bg-elevated p-1 rounded-md w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-[8px] text-sm font-semibold transition-all ${
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
                      pred={predMap.get(m.id) ?? { home: '', away: '', pts: null, is_modified: false, exists_in_db: false }}
                      onChange={(h, a) => setPred(m.id, h, a)}
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
        />
      )}

      {/* ── Bonus ── */}
      {tab === 'bonus' && (
        <BonusTab tournament={tournament} locked={bonusLocked} />
      )}

      {/* ── Ranking ── */}
      {tab === 'ranking' && (
        <ProdeRankingTab
          entries={rankingEntries}
          loading={rankingLoading}
          myUserId={myUserId}
        />
      )}

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
  entries, loading, myUserId,
}: {
  entries: RankingEntry[]
  loading: boolean
  myUserId: string | null
}) {
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
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 px-4 py-2.5 border-b border-border bg-elevated/60">
        <span className="text-muted text-[10px] font-semibold uppercase tracking-widest">#</span>
        <span className="text-muted text-[10px] font-semibold uppercase tracking-widest">Jugador</span>
        <span className="text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Partidos</span>
        <span className="text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Bonus</span>
        <span className="text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Total</span>
      </div>

      {entries.map((entry, idx) => {
        const isMe    = entry.userId === myUserId
        const medal   = entry.rank > 0 ? medalFor(entry.rank) : ''
        const rankLabel = entry.rank > 0 ? (medal || `#${entry.rank}`) : '—'

        return (
          <div
            key={entry.userId}
            className={[
              'grid grid-cols-[2rem_1fr_4rem_4rem_4rem] gap-2 px-4 py-3 items-center',
              idx < entries.length - 1 ? 'border-b border-border/50' : '',
              isMe ? 'bg-brand/5' : '',
            ].join(' ')}
          >
            <span className={`text-sm font-bold leading-none ${isMe ? 'text-brand' : 'text-muted'}`}>
              {rankLabel}
            </span>
            <div className="flex items-center gap-2.5 min-w-0">
              <RankingAvatar url={entry.avatarUrl} name={entry.displayName} />
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate leading-tight ${isMe ? 'text-brand' : 'text-text'}`}>
                  {entry.displayName}
                  {isMe && <span className="text-[10px] ml-1 opacity-60">(vos)</span>}
                </p>
                <p className="text-muted text-[10px] mt-0.5">{entry.matchesScored} resultados</p>
              </div>
            </div>
            <span className="text-text text-sm font-semibold text-right">{entry.matchPts}</span>
            <span className="text-text text-sm font-semibold text-right">{entry.bonusPts}</span>
            <span className={`text-sm font-bold text-right ${isMe ? 'text-brand' : 'text-text'}`}>
              {entry.totalPts}
            </span>
          </div>
        )
      })}
    </div>
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
  roundsMap, predMap, onPred,
}: {
  roundsMap: Map<string, CompetitionMatch[]>
  predMap:   PredMap
  onPred:    (matchId: string, home: string, away: string) => void
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
                    pred={predMap.get(m.id) ?? { home: '', away: '', pts: null, is_modified: false, exists_in_db: false }}
                    onChange={(h, a) => onPred(m.id, h, a)}
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
