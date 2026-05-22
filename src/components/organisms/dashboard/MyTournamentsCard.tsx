import { useNavigate } from 'react-router-dom'
import type { MyTournamentPosition } from '../../../services/rankingService'

function medalFor(rank: number | null): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

export default function MyTournamentsCard({
  positions, loading,
}: {
  positions: MyTournamentPosition[]
  loading:   boolean
}) {
  const navigate = useNavigate()

  return (
    <div className="lg:col-span-4 card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Mis torneos</span>
        <button
          onClick={() => navigate('/torneos')}
          className="text-brand text-xs font-semibold hover:underline"
        >
          Ver todos
        </button>
      </div>

      <div className="flex-1 space-y-1">
        {loading && (
          <p className="text-muted text-xs text-center py-4">Cargando...</p>
        )}

        {!loading && positions.length === 0 && (
          <p className="text-muted text-xs text-center py-4">No estás en ningún torneo aún.</p>
        )}

        {!loading && positions.map(pos => {
          const medal = medalFor(pos.rank)
          return (
            <div
              key={pos.tournamentId}
              className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-elevated/40 rounded-lg px-1 -mx-1 transition-colors"
              onClick={() => navigate(`/torneos/${pos.tournamentId}/prode`)}
            >
              {/* Imagen del torneo */}
              <div className="w-9 h-9 rounded-xl bg-elevated flex items-center justify-center shrink-0 overflow-hidden">
                {pos.tournamentImage
                  ? <img src={pos.tournamentImage} alt={pos.tournamentName} className="w-full h-full object-cover" />
                  : <span className="text-lg">🏆</span>
                }
              </div>

              {/* Nombre + label */}
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm font-medium truncate leading-tight">{pos.tournamentName}</p>
                <p className="text-muted text-[11px] mt-0.5">
                  {pos.totalPts} pts
                </p>
              </div>

              {/* Posición */}
              {pos.rank !== null ? (
                <div className="flex items-center gap-1 shrink-0">
                  {medal && <span className="text-base leading-none">{medal}</span>}
                  <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center shadow-[0_0_12px_rgba(255,116,3,0.4)]">
                    <span className="text-white text-[11px] font-bold">#{pos.rank}</span>
                  </div>
                </div>
              ) : (
                <span className="text-muted text-[11px] shrink-0">Sin pts</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
