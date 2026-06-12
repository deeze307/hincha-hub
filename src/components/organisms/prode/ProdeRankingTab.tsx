import { useState } from 'react'
import { Loader2, UserMinus, Users } from 'lucide-react'
import type { RankingEntry } from '../../../services/rankingService'
import { removeParticipant } from '../../../services/tournamentsService'
import { useModal } from '../../../contexts/ModalContext'
import { useToast } from '../../../contexts/ToastContext'
import { PlayerPointsSheet, type PlayerSheetInfo } from './PlayerPointsSheet'

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

export function ProdeRankingTab({
  entries, loading, myUserId, tournamentId, isAdmin, createdBy, onRemoveEntry,
}: {
  entries:        RankingEntry[]
  loading:        boolean
  myUserId:       string | null
  tournamentId:   string
  isAdmin:        boolean
  createdBy:      string | null
  onRemoveEntry:  (userId: string) => void
}) {
  const [selectedUser, setSelectedUser] = useState<PlayerSheetInfo | null>(null)
  const { confirm }   = useModal()
  const { showToast } = useToast()

  const gridBase = isAdmin
    ? 'grid-cols-[2rem_1fr_3.5rem_2rem] sm:grid-cols-[2rem_1fr_4.5rem_4rem_4rem_2rem]'
    : 'grid-cols-[2rem_1fr_3.5rem] sm:grid-cols-[2rem_1fr_4.5rem_4rem_4rem]'

  function handleRemove(entry: RankingEntry) {
    confirm({
      title:          'Quitar participante',
      message:        `¿Querés quitar a ${entry.displayName} del torneo? Esta acción no se puede deshacer.`,
      confirmLabel:   'Quitar',
      confirmVariant: 'danger',
      onConfirm:      async () => {
        try {
          await removeParticipant(tournamentId, entry.userId)
          onRemoveEntry(entry.userId)
          showToast(`${entry.displayName} fue quitado del torneo.`, 'success')
        } catch {
          showToast('Error al quitar el participante. Intentá de nuevo.', 'error')
        }
      },
    })
  }

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
      {/* Conteo de participantes */}
      <div className="flex items-center gap-1.5 text-muted text-xs mb-3">
        <Users size={13} />
        <span>{entries.length} participante{entries.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="card overflow-hidden">
        {/* Header */}
        <div className={`grid ${gridBase} gap-2 px-4 py-2.5 border-b border-border bg-elevated/60`}>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest">#</span>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest">Jugador</span>
          <span className="hidden sm:block text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Partidos</span>
          <span className="hidden sm:block text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Bonus</span>
          <span className="text-muted text-[10px] font-semibold uppercase tracking-widest text-right">Total</span>
          {isAdmin && <span />}
        </div>

        {entries.map((entry, idx) => {
          const isMe      = entry.userId === myUserId
          const isOwner   = entry.userId === createdBy
          const canRemove = isAdmin && !isMe && !isOwner
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
              {isAdmin && (
                canRemove ? (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleRemove(entry) }}
                    title={`Quitar a ${entry.displayName}`}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <UserMinus size={14} />
                  </button>
                ) : (
                  <span />
                )
              )}
            </>
          )

          const rowClass = [
            `w-full text-left grid ${gridBase} gap-2 px-4 py-3 items-center`,
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
