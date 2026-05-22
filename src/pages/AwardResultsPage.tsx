import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Search, X, Loader2, CheckCircle, Trophy, Star, Target, Award, Shield, RefreshCw } from 'lucide-react'
import { fetchTournaments } from '../services/tournamentsService'
import { BONUS_TYPE_LABELS } from '../services/tournamentsService'
import { fetchAwardResults, saveAwardResult, deleteAwardResult } from '../services/awardResultsService'
import { searchTeams, searchPlayers } from '../services/teamsService'
import { useAuth } from '../contexts/AuthContext'
import type { Tournament, BonusType } from '../services/tournamentsService'
import type { AwardResult } from '../services/awardResultsService'
import type { TeamOption, PlayerOption } from '../services/teamsService'

const BONUS_ICON: Record<BonusType, React.FC<{ size?: number; className?: string }>> = {
  champion:        Trophy,
  top_scorer:      Star,
  top_assists:     Target,
  mvp:             Award,
  best_goalkeeper: Shield,
}

const AUTO_BONUS_TYPES = new Set<BonusType>(['champion', 'top_scorer', 'top_assists'])

const BONUS_KIND: Record<BonusType, 'team' | 'player'> = {
  champion:        'team',
  top_scorer:      'player',
  top_assists:     'player',
  mvp:             'player',
  best_goalkeeper: 'player',
}

// ─── Team autocomplete ────────────────────────────────────────────

function TeamSearch({
  teamType, onSelect,
}: {
  teamType: 'national' | 'club'
  onSelect: (t: { id: string; name: string; logo_url: string | null }) => void
}) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<TeamOption[]>([])
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try { const r = await searchTeams(query, teamType); setResults(r); setOpen(true) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query, teamType])

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-lg border border-border focus-within:border-brand transition-colors">
        <Search size={14} className="text-muted shrink-0" />
        <input
          type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar equipo..."
          className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-muted-dark"
        />
        {loading && <Loader2 size={12} className="text-muted animate-spin shrink-0" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-elevated z-20 max-h-48 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              onMouseDown={() => { onSelect({ id: r.id, name: r.name, logo_url: r.logo_url }); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elevated transition-colors text-left"
            >
              {r.logo_url
                ? <img src={r.logo_url} alt={r.name} className="w-5 h-5 object-contain shrink-0" />
                : <div className="w-5 h-5 rounded-full bg-elevated border border-border shrink-0" />
              }
              <span className="text-text text-sm flex-1 truncate">{r.name}</span>
              {r.country && <span className="text-muted text-xs shrink-0">{r.country}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Player autocomplete ──────────────────────────────────────────

function PlayerSearch({
  competitionId, onSelect,
}: {
  competitionId: string
  onSelect: (p: { id: string; name: string }) => void
}) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<PlayerOption[]>([])
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try { const r = await searchPlayers(query, competitionId); setResults(r); setOpen(true) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query, competitionId])

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-lg border border-border focus-within:border-brand transition-colors">
        <Search size={14} className="text-muted shrink-0" />
        <input
          type="text" value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar jugador..."
          className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-muted-dark"
        />
        {loading && <Loader2 size={12} className="text-muted animate-spin shrink-0" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-elevated z-20 max-h-48 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              onMouseDown={() => { onSelect({ id: r.id, name: r.name }); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elevated transition-colors text-left"
            >
              {r.photo_url
                ? <img src={r.photo_url} alt={r.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                : <div className="w-5 h-5 rounded-full bg-elevated border border-border shrink-0" />
              }
              <span className="text-text text-sm flex-1 truncate">{r.name}</span>
              {(r.team as any)?.name && <span className="text-muted text-xs shrink-0">{(r.team as any).name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────

export default function AwardResultsPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [results,    setResults]    = useState<AwardResult[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState<BonusType | null>(null)
  const [saved,      setSaved]      = useState<BonusType | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [all, awards] = await Promise.all([
          fetchTournaments(),
          fetchAwardResults(id!),
        ])
        const t = all.find(x => x.id === id)
        if (!t) { navigate('/torneos'); return }

        const isOwner      = t.created_by === profile?.id
        const isSuperAdmin = profile?.role === 'superadmin'
        if (!isOwner && !isSuperAdmin) { navigate('/torneos'); return }

        setTournament(t)
        setResults(awards)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, profile?.id])

  const bonusTypes: BonusType[] = tournament?.prode_config?.bonus_types?.length
    ? tournament.prode_config.bonus_types
    : ['champion', 'top_scorer']

  function resultFor(type: BonusType): AwardResult | undefined {
    return results.find(r => r.award_type === type)
  }

  async function handleSave(
    type: BonusType,
    winner: { team_id?: string | null; team_name?: string | null; team_logo_url?: string | null; player_id?: string | null; player_name?: string | null },
  ) {
    setSaving(type)
    try {
      await saveAwardResult(id!, type, winner)
      setResults(prev => {
        const next = prev.filter(r => r.award_type !== type)
        return [...next, { id: '', tournament_id: id!, award_type: type, resolved_at: new Date().toISOString(), ...winner } as AwardResult]
      })
      setSaved(type)
      setTimeout(() => setSaved(null), 2500)
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(type: BonusType) {
    await deleteAwardResult(id!, type)
    setResults(prev => prev.filter(r => r.award_type !== type))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="text-brand animate-spin" />
      </div>
    )
  }

  if (!tournament) return null

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/torneos')}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors shrink-0"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-text text-xl font-semibold tracking-tight leading-tight">Premios del torneo</h1>
          <p className="text-muted text-sm mt-0.5 truncate">{tournament.name}</p>
        </div>
      </div>

      <div className="bg-brand/10 border border-brand/25 rounded-xl px-4 py-3">
        <p className="text-sm text-text">
          Cargá aquí al ganador real de cada premio. Una vez guardado, <span className="font-semibold">score-predictions</span> calculará automáticamente los puntos de los participantes.
        </p>
      </div>

      <div className="space-y-4">
        {bonusTypes.map(bonusType => {
          const Icon    = BONUS_ICON[bonusType]
          const kind    = BONUS_KIND[bonusType]
          const current = resultFor(bonusType)
          const isSaving = saving === bonusType
          const isSaved  = saved === bonusType

          const isAuto = AUTO_BONUS_TYPES.has(bonusType)

          return (
            <div key={bonusType} className="card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-elevated/50">
                <Icon size={16} className="text-brand" />
                <h3 className="text-text text-sm font-semibold">{BONUS_TYPE_LABELS[bonusType]}</h3>
                {isAuto && !isSaved && (
                  <span className="ml-auto flex items-center gap-1 text-sky-400 text-[11px] font-semibold bg-sky-400/10 border border-sky-400/25 px-2 py-0.5 rounded-full">
                    <RefreshCw size={10} /> Auto
                  </span>
                )}
                {isSaved && (
                  <span className="ml-auto flex items-center gap-1 text-green-400 text-xs font-semibold">
                    <CheckCircle size={13} /> Guardado
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                {/* Ganador actual */}
                {current && (
                  <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/25 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-green-400 text-xs font-semibold uppercase tracking-wide mb-0.5">
                        {isAuto ? 'Sincronizado desde la API' : 'Ganador cargado'}
                      </p>
                      <p className="text-text text-sm font-semibold truncate">
                        {kind === 'team' ? current.team_name : current.player_name}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(bonusType)}
                      className="text-muted hover:text-red-400 p-1 rounded hover:bg-red-400/10 transition-colors shrink-0"
                      title="Quitar ganador"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* Buscador */}
                <div>
                  <p className="text-muted text-xs mb-2">
                    {isAuto
                      ? current ? 'Forzar resultado manualmente:' : 'Aún no sincronizado. Podés cargarlo a mano:'
                      : current ? 'Reemplazar ganador:' : 'Cargar ganador:'}
                  </p>
                  {kind === 'team' ? (
                    <TeamSearch
                      teamType={tournament.team_type}
                      onSelect={t => handleSave(bonusType, {
                        team_id:       t.id,
                        team_name:     t.name,
                        team_logo_url: t.logo_url,
                      })}
                    />
                  ) : (
                    <PlayerSearch
                      competitionId={tournament.competition_id ?? ''}
                      onSelect={p => handleSave(bonusType, {
                        player_id:   p.id,
                        player_name: p.name,
                      })}
                    />
                  )}
                </div>

                {isAuto && !current && (
                  <p className="text-muted-dark text-[11px] leading-relaxed">
                    Se actualiza automáticamente cada vez que se sincroniza el fixture.
                  </p>
                )}

                {isSaving && (
                  <div className="flex items-center gap-2 text-muted text-xs">
                    <Loader2 size={12} className="animate-spin" /> Guardando...
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
