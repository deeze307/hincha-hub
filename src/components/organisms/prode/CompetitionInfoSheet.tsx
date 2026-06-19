import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import {
  fetchCompetitionStandings, fetchCompetitionPlayerStats,
  type StandingGroup, type PlayerStats, type StatType,
} from '../../../services/competitionStatsService'
import { TeamLogo } from '../../atoms/TeamLogo'

const STAT_LABELS: Record<StatType, string> = {
  goals:        'Goles',
  assists:      'Asistencias',
  yellow_cards: 'Amarillas',
  red_cards:    'Rojas',
}

const STAT_ORDER: StatType[] = ['goals', 'assists', 'yellow_cards', 'red_cards']

const EMPTY_STATS: PlayerStats = { goals: [], assists: [], yellow_cards: [], red_cards: [] }

export function CompetitionInfoSheet({
  competitionId, seasonYear, competitionName, onClose,
}: {
  competitionId:   string
  seasonYear:      number
  competitionName: string | null
  onClose:         () => void
}) {
  const [entered, setEntered] = useState(false)
  const [closing, setClosing] = useState(false)
  const [dragY,   setDragY]   = useState(0)
  const startYRef = useRef(0)
  const dragging  = useRef(false)

  const [tab,       setTab]       = useState<'standings' | 'stats'>('standings')
  const [statCat,   setStatCat]   = useState<StatType>('goals')
  const [standings, setStandings] = useState<StandingGroup[]>([])
  const [stats,     setStats]     = useState<PlayerStats>(EMPTY_STATS)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    Promise.all([
      fetchCompetitionStandings(competitionId, seasonYear),
      fetchCompetitionPlayerStats(competitionId, seasonYear),
    ])
      .then(([s, ps]) => {
        setStandings(s)
        setStats(ps)
        if (!s.length) setTab('stats')   // sin tabla → mostrar estadísticas directo
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [competitionId, seasonYear])

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

  const hasStandings = standings.length > 0
  const subTabs: { key: 'standings' | 'stats'; label: string }[] = [
    ...(hasStandings ? [{ key: 'standings' as const, label: 'Posiciones' }] : []),
    { key: 'stats' as const, label: 'Estadísticas' },
  ]

  function StandingsView() {
    return (
      <div className="space-y-5">
        {standings.map(g => (
          <div key={g.group ?? 'tabla'}>
            {g.group && <h3 className="text-text text-sm font-semibold mb-2">{g.group}</h3>}
            <div className="rounded-lg overflow-hidden border border-border/50">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-elevated">
                    <th className="px-1.5 py-1.5 text-center text-muted font-semibold w-4">#</th>
                    <th className="px-1.5 py-1.5 text-left text-muted font-semibold">Equipo</th>
                    <th className="px-1 py-1.5 text-center text-muted font-semibold">PJ</th>
                    <th className="px-1 py-1.5 text-center text-muted font-semibold">PG</th>
                    <th className="px-1 py-1.5 text-center text-muted font-semibold">PE</th>
                    <th className="px-1 py-1.5 text-center text-muted font-semibold">PP</th>
                    <th className="px-1 py-1.5 text-center text-muted font-semibold">DG</th>
                    <th className="px-1.5 py-1.5 text-center text-muted font-semibold">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(r => {
                    const dg = r.goals_for - r.goals_against
                    return (
                      <tr key={r.rank} className="border-t border-border/30">
                        <td className="px-1.5 py-1.5 text-center text-muted text-[10px] font-bold">{r.rank}</td>
                        <td className="px-1.5 py-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <TeamLogo url={r.team_logo_url} name={r.team_name ?? '?'} size={16} />
                            <span className="text-text font-medium truncate inline-block max-w-[5rem] sm:max-w-[11rem] align-middle">{r.team_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-1 py-1.5 text-center text-muted tabular-nums">{r.played}</td>
                        <td className="px-1 py-1.5 text-center text-muted tabular-nums">{r.win}</td>
                        <td className="px-1 py-1.5 text-center text-muted tabular-nums">{r.draw}</td>
                        <td className="px-1 py-1.5 text-center text-muted tabular-nums">{r.lose}</td>
                        <td className="px-1 py-1.5 text-center text-muted tabular-nums">{dg > 0 ? '+' : ''}{dg}</td>
                        <td className="px-1.5 py-1.5 text-center text-text font-bold tabular-nums">{r.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function StatsView() {
    const rows = stats[statCat]
    return (
      <div className="space-y-3">
        {/* Selector de categoría */}
        <div className="flex gap-1 bg-elevated p-1 rounded-lg overflow-x-auto">
          {STAT_ORDER.map(t => (
            <button
              key={t}
              onClick={() => setStatCat(t)}
              className={`flex-1 whitespace-nowrap px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                statCat === t ? 'bg-brand text-white' : 'text-muted hover:text-text'
              }`}
            >
              {STAT_LABELS[t]}
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-muted text-sm text-center py-8">Sin datos de {STAT_LABELS[statCat].toLowerCase()} todavía.</p>
        ) : (
          <div className="rounded-lg overflow-hidden border border-border/50 divide-y divide-border/30">
            {rows.map(r => (
              <div key={r.rank} className="flex items-center gap-2.5 px-3 py-2">
                <span className="w-5 text-center text-muted text-[11px] font-bold shrink-0">{r.rank}</span>
                {r.player_photo_url
                  ? <img src={r.player_photo_url} alt={r.player_name ?? ''} className="w-7 h-7 rounded-full object-cover shrink-0" />
                  : <div className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center text-[9px] font-bold text-muted shrink-0 border border-border">{(r.player_name ?? '?').slice(0, 2).toUpperCase()}</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-text text-sm font-medium truncate leading-tight">{r.player_name ?? '—'}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TeamLogo url={r.team_logo_url} name={r.team_name ?? '?'} size={12} />
                    <span className="text-muted-dark text-[10px] truncate">{r.team_name ?? ''}</span>
                  </div>
                </div>
                <span className="text-brand text-sm font-bold tabular-nums shrink-0">{r.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function Content() {
    return (
      <>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-text text-base font-bold leading-tight">Posiciones y stats</h2>
            {competitionName && <p className="text-muted text-[11px] mt-0.5 truncate">{competitionName}</p>}
          </div>
          <button onClick={handleClose} className="text-muted hover:text-text p-1 rounded-lg hover:bg-elevated transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="text-brand animate-spin" />
          </div>
        ) : !hasStandings && stats.goals.length === 0 && stats.assists.length === 0 && stats.yellow_cards.length === 0 && stats.red_cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
            <span className="text-2xl">📊</span>
            <p className="text-muted text-sm">Todavía no hay posiciones ni estadísticas para esta competición.</p>
          </div>
        ) : (
          <>
            {/* Sub-tabs */}
            {subTabs.length > 1 && (
              <div className="px-4 pt-3 shrink-0">
                <div className="flex gap-1 bg-elevated p-1 rounded-md w-full">
                  {subTabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex-1 px-3 py-1.5 rounded-[8px] text-sm font-semibold transition-all ${
                        tab === t.key ? 'bg-brand text-white' : 'text-muted hover:text-text'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-y-auto px-4 py-4" style={{ maxHeight: '60vh' }}>
              {tab === 'standings' && hasStandings ? <StandingsView /> : <StatsView />}
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        style={{ opacity: entered && !closing ? 1 : 0, transition: 'opacity 0.3s' }}
      />
      {/* Mobile: bottom sheet */}
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
        <Content />
      </div>
      {/* Desktop: modal centrado */}
      <div
        className="hidden sm:block relative w-full max-w-lg bg-surface rounded-2xl shadow-elevated overflow-hidden mx-4"
        style={modalStyle}
      >
        <Content />
      </div>
    </div>
  )
}
