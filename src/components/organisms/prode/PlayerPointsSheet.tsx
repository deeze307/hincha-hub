import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { fetchUserMatchBreakdown } from '../../../services/rankingService'
import type { UserMatchBreakdown } from '../../../services/rankingService'

export interface PlayerSheetInfo {
  userId:      string
  displayName: string
  avatarUrl:   string | null
  totalPts:    number
  matchPts:    number
  bonusPts:    number
}

export function PlayerPointsSheet({
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
      {/* Mobile: bottom sheet — padding inferior para no quedar tapado por el BottomNav */}
      <div
        className="sm:hidden relative w-full bg-surface rounded-t-2xl shadow-elevated overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
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
