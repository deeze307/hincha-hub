import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Save, Lock, CheckCircle, ChevronLeft } from 'lucide-react'
import { fetchTournaments } from '../services/tournamentsService'
import { fetchMatchesByCompetition, groupMatchesByGroup, groupMatchesByRound } from '../services/matchesService'
import {
  fetchUserPredictions, saveMatchPredictions, calcPoints,
} from '../services/predictionsService'
import type { Tournament } from '../services/tournamentsService'
import type { CompetitionMatch } from '../services/matchesService'
import type { MatchPrediction } from '../services/predictionsService'

// ─── Tipos locales ────────────────────────────────────────────────

interface ScoreInput {
  home: string
  away: string
}

type PredMap = Map<string, ScoreInput>  // match_id → scores

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

  function ensure(match: CompetitionMatch, team: CompetitionMatch['home_team']) {
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

// ─── Determinar si el prode está bloqueado ───────────────────────

function isLocked(tournament: Tournament, matches: CompetitionMatch[]): boolean {
  // Usar prediction_deadline si está configurada
  if (tournament.prediction_deadline) {
    return new Date() >= new Date(tournament.prediction_deadline)
  }
  // Sino, primer partido - 2 horas
  const groupMatches = matches.filter(m => m.round_order === 1)
  if (!groupMatches.length) return false
  const dates = groupMatches
    .map(m => m.match_date)
    .filter(Boolean)
    .map(d => new Date(d!).getTime())
  if (!dates.length) return false
  const firstMatch = Math.min(...dates)
  return Date.now() >= firstMatch - 2 * 60 * 60 * 1000
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
  match, pred, locked, onChange,
}: {
  match:    CompetitionMatch
  pred:     ScoreInput
  locked:   boolean
  onChange: (home: string, away: string) => void
}) {
  // Puntos ya ganados si el partido terminó
  const pts = calcPoints(
    pred.home !== '' ? parseInt(pred.home) : null,
    pred.away !== '' ? parseInt(pred.away) : null,
    match.home_score, match.away_score,
  )

  const dateStr = match.match_date
    ? new Date(match.match_date).toLocaleString('es-AR', {
        weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—'

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/40 last:border-0">
      {/* Equipo local */}
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        <span className="text-text text-sm font-medium truncate text-right hidden sm:block">
          {match.home_team?.name ?? '—'}
        </span>
        <TeamLogo url={match.home_team?.logo_url ?? null} name={match.home_team?.name ?? '?'} />
      </div>

      {/* Inputs */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ScoreBox value={pred.home} onChange={v => onChange(v, pred.away)} locked={locked} />
        <span className="text-muted-dark text-xs font-semibold">-</span>
        <ScoreBox value={pred.away} onChange={v => onChange(pred.home, v)} locked={locked} />
      </div>

      {/* Equipo visitante */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <TeamLogo url={match.away_team?.logo_url ?? null} name={match.away_team?.name ?? '?'} />
        <span className="text-text text-sm font-medium truncate hidden sm:block">
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
            {pts != null && (
              <span className={`text-[11px] font-bold ${
                pts === 3 ? 'text-green-400' : pts === 1 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {pts === 3 ? '+3' : pts === 1 ? '+1' : '+0'}
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
  const [tab,        setTab]        = useState<'groups' | 'knockout' | 'bonus'>('groups')

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
          fetchUserPredictions(id),
        ])

        setMatches(ms)

        // Poblar el map de predicciones
        const map: PredMap = new Map()
        for (const p of preds) {
          map.set(p.match_id, {
            home: p.home_prediction != null ? String(p.home_prediction) : '',
            away: p.away_prediction != null ? String(p.away_prediction) : '',
          })
        }
        // Inicializar celdas vacías para partidos sin predicción
        for (const m of ms) {
          if (!map.has(m.id)) map.set(m.id, { home: '', away: '' })
        }
        setPredMap(map)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const locked = useMemo(() =>
    tournament ? isLocked(tournament, matches) : false,
    [tournament, matches],
  )

  const groupMatchesMap  = useMemo(() => groupMatchesByGroup(matches),  [matches])
  const knockoutRoundsMap = useMemo(() => groupMatchesByRound(matches), [matches])

  const config = tournament?.prode_config
  const directQ  = config?.direct_qualifiers ?? 2
  const bestThird = config?.best_third_count  ?? 0

  function setPred(matchId: string, home: string, away: string) {
    setPredMap(prev => {
      const next = new Map(prev)
      next.set(matchId, { home, away })
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    if (!id || locked) return
    setSaving(true)
    try {
      const all = [...predMap.entries()]
        .filter(([, v]) => v.home !== '' || v.away !== '')
        .map(([match_id, v]) => ({
          match_id,
          home: v.home !== '' ? parseInt(v.home) : null,
          away: v.away !== '' ? parseInt(v.away) : null,
        }))
      await saveMatchPredictions(id, all)
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
  ] as { key: typeof tab; label: string }[]

  // Conteo de predicciones completas
  const groupMatches  = matches.filter(m => m.round_order === 1)
  const filledCount   = groupMatches.filter(m => {
    const p = predMap.get(m.id)
    return p && p.home !== '' && p.away !== ''
  }).length

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/torneos')}
            className="mt-1 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-text text-xl font-semibold tracking-tight">{tournament.name}</h1>
            <p className="text-muted text-sm mt-1">
              {tournament.competition?.name ?? ''} · Prode
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {locked ? (
            <div className="flex items-center gap-2 text-muted text-sm">
              <Lock size={14} />
              <span>Predicciones cerradas</span>
            </div>
          ) : (
            <>
              <span className="text-muted text-xs">
                {filledCount}/{groupMatches.length} partidos completados
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
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

      {/* Deadline banner */}
      {!locked && (
        <DeadlineBanner tournament={tournament} matches={matches} />
      )}

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
                      pred={predMap.get(m.id) ?? { home: '', away: '' }}
                      locked={locked}
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
          locked={locked}
          onPred={setPred}
        />
      )}

      {/* ── Bonus ── */}
      {tab === 'bonus' && (
        <div className="card p-10 text-center text-muted">
          <p className="text-sm">Bonus disponible próximamente.</p>
          <p className="text-xs text-muted-dark mt-1">
            Selección de campeón y goleador del torneo.
          </p>
        </div>
      )}

    </div>
  )
}

// ─── Banner de deadline ───────────────────────────────────────────

function DeadlineBanner({ tournament, matches }: { tournament: Tournament; matches: CompetitionMatch[] }) {
  let deadline: Date | null = null

  if (tournament.prediction_deadline) {
    deadline = new Date(tournament.prediction_deadline)
  } else {
    const groupDates = matches
      .filter(m => m.round_order === 1 && m.match_date)
      .map(m => new Date(m.match_date!).getTime())
    if (groupDates.length) {
      deadline = new Date(Math.min(...groupDates) - 2 * 60 * 60 * 1000)
    }
  }

  if (!deadline) return null

  const diff = deadline.getTime() - Date.now()
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins  = Math.floor((diff % 3600000) / 60000)

  const label = days > 0
    ? `${days}d ${hours}h`
    : hours > 0 ? `${hours}h ${mins}min`
    : `${mins} minutos`

  const deadlineStr = deadline.toLocaleString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="bg-brand/10 border border-brand/25 rounded-xl px-4 py-3 flex items-center gap-3">
      <Lock size={14} className="text-brand shrink-0" />
      <p className="text-sm text-text">
        Tiempo para predecir:{' '}
        <span className="font-semibold text-brand">{label}</span>
        <span className="text-muted ml-2 text-xs">· Cierra el {deadlineStr}</span>
      </p>
    </div>
  )
}

// ─── Tab Eliminatoria ─────────────────────────────────────────────

function KnockoutTab({
  roundsMap, predMap, locked, onPred,
}: {
  roundsMap: Map<string, CompetitionMatch[]>
  predMap:   PredMap
  locked:    boolean
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
                    pred={predMap.get(m.id) ?? { home: '', away: '' }}
                    locked={locked}
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
