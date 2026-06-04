import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchTournamentRanking } from '../services/rankingService'
import type { RankingEntry } from '../services/rankingService'
import { removeParticipant } from '../services/tournamentsService'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useModal } from '../contexts/ModalContext'
import { useToast } from '../contexts/ToastContext'
import { ChevronLeft, UserMinus } from 'lucide-react'

function medalFor(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  if (url) {
    return <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />
  }
  return (
    <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
      <span className="text-brand text-xs font-bold">{initials}</span>
    </div>
  )
}

export default function TournamentRankingPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const { profile }   = useAuth()
  const { confirm }   = useModal()
  const { showToast } = useToast()

  const [entries,        setEntries]        = useState<RankingEntry[]>([])
  const [loading,        setLoading]        = useState(true)
  const [tournamentName, setTournamentName] = useState('')
  const [createdBy,      setCreatedBy]      = useState<string | null>(null)

  const myUserId = profile?.id ?? null
  const isAdmin  = myUserId !== null && (
    myUserId === createdBy || profile?.role === 'superadmin'
  )

  const gridCols = isAdmin
    ? 'grid-cols-[2rem_1fr_4rem_4rem_4rem_2rem]'
    : 'grid-cols-[2rem_1fr_4rem_4rem_4rem]'

  useEffect(() => {
    if (!id) return
    supabase
      .from('tournaments')
      .select('name, created_by')
      .eq('id', id)
      .single()
      .then(({ data }: { data: any }) => {
        setTournamentName(data?.name ?? 'Torneo')
        setCreatedBy(data?.created_by ?? null)
      })

    fetchTournamentRanking(id)
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [id])

  function handleRemove(entry: RankingEntry) {
    confirm({
      title:          'Quitar participante',
      message:        `¿Querés quitar a ${entry.displayName} del torneo? Esta acción no se puede deshacer.`,
      confirmLabel:   'Quitar',
      confirmVariant: 'danger',
      onConfirm:      async () => {
        try {
          await removeParticipant(id!, entry.userId)
          setEntries(prev => prev.filter(e => e.userId !== entry.userId))
          showToast(`${entry.displayName} fue quitado del torneo.`, 'success')
        } catch {
          showToast('Error al quitar el participante. Intentá de nuevo.', 'error')
        }
      },
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center hover:bg-border/50 transition-colors"
        >
          <ChevronLeft size={18} className="text-muted" />
        </button>
        <div>
          <h1 className="text-text text-lg font-semibold leading-tight">{tournamentName}</h1>
          <p className="text-muted text-xs">Ranking</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        {/* Encabezado */}
        <div className={`grid ${gridCols} gap-2 px-4 py-2.5 border-b border-border bg-elevated/60`}>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest">#</span>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest">Jugador</span>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Partidos</span>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Bonus</span>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Total</span>
          {isAdmin && <span />}
        </div>

        {loading && (
          <p className="text-muted text-sm text-center py-8">Cargando ranking...</p>
        )}

        {!loading && entries.length === 0 && (
          <p className="text-muted text-sm text-center py-8">Aún no hay participantes.</p>
        )}

        {!loading && entries.map((entry, idx) => {
          const isMe      = entry.userId === myUserId
          const isOwner   = entry.userId === createdBy
          const medal     = entry.rank > 0 ? medalFor(entry.rank) : ''
          const rankLabel = entry.rank > 0 ? (medal || `#${entry.rank}`) : '—'
          const canRemove = isAdmin && !isMe && !isOwner

          return (
            <div
              key={entry.userId}
              className={[
                `grid ${gridCols} gap-2 px-4 py-3 items-center`,
                idx < entries.length - 1 ? 'border-b border-border/50' : '',
                isMe ? 'bg-brand/5' : '',
              ].join(' ')}
            >
              {/* Rank */}
              <span className={`text-sm font-bold leading-none ${isMe ? 'text-brand' : 'text-muted'}`}>
                {rankLabel}
              </span>

              {/* Avatar + nombre */}
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar url={entry.avatarUrl} name={entry.displayName} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate leading-tight ${isMe ? 'text-brand' : 'text-text'}`}>
                    {entry.displayName}
                    {isMe && <span className="text-[10px] ml-1 opacity-60">(vos)</span>}
                  </p>
                  <p className="text-muted text-[10px] mt-0.5">
                    {entry.matchesScored} resultados
                  </p>
                </div>
              </div>

              {/* Puntos partidos */}
              <span className="text-text text-sm font-semibold text-right">{entry.matchPts}</span>

              {/* Puntos bonus */}
              <span className="text-text text-sm font-semibold text-right">{entry.bonusPts}</span>

              {/* Total */}
              <span className={`text-sm font-bold text-right ${isMe ? 'text-brand' : 'text-text'}`}>
                {entry.totalPts}
              </span>

              {/* Quitar (solo admin, no al creador ni a sí mismo) */}
              {isAdmin && (
                canRemove ? (
                  <button
                    onClick={() => handleRemove(entry)}
                    title={`Quitar a ${entry.displayName}`}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <UserMinus size={14} />
                  </button>
                ) : (
                  <span />
                )
              )}
            </div>
          )
        })}
      </div>

      {/* Leyenda */}
      {!loading && entries.length > 0 && (
        <p className="text-muted text-[11px] text-center">
          Jugadores sin predicciones aparecen al final sin posición.
        </p>
      )}
    </div>
  )
}
