import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchMatchesByCompetition } from '../../services/matchesService'
import type { CompetitionMatch } from '../../services/matchesService'
import type { TeamDetailInfo } from '../../hooks/useTeamDetail'

function groupByRealGroupName(matches: CompetitionMatch[]): Map<string, CompetitionMatch[]> {
  const map = new Map<string, CompetitionMatch[]>()
  for (const m of matches.filter(m => m.round_order === 1 && m.group_name != null)) {
    const key = m.group_name!
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  return map
}

// ─── Standings con resultados reales ─────────────────────────────

interface TeamStanding {
  teamId: string; teamName: string; logoUrl: string | null
  pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; pts: number
}

const FINAL = new Set(['FT', 'AET', 'PEN'])

function calcRealStandings(matches: CompetitionMatch[]): TeamStanding[] {
  const s = new Map<string, TeamStanding>()

  for (const m of matches) {
    for (const t of [m.home_team, m.away_team]) {
      if (t && !s.has(t.id))
        s.set(t.id, { teamId: t.id, teamName: t.name, logoUrl: t.logo_url ?? null, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 })
    }
  }

  for (const m of matches) {
    if (!FINAL.has(m.status) || m.home_score == null || m.away_score == null) continue
    if (!m.home_team || !m.away_team) continue
    const home = s.get(m.home_team.id)!
    const away = s.get(m.away_team.id)!
    home.pj++; away.pj++
    home.gf += m.home_score; home.gc += m.away_score
    away.gf += m.away_score; away.gc += m.home_score
    if (m.home_score > m.away_score)       { home.pg++; home.pts += 3; away.pp++ }
    else if (m.home_score === m.away_score) { home.pe++; home.pts++;   away.pe++; away.pts++ }
    else                                    { away.pg++; away.pts += 3; home.pp++ }
  }

  return [...s.values()].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    const dgB = b.gf - b.gc, dgA = a.gf - a.gc
    if (dgB !== dgA) return dgB - dgA
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.teamName.localeCompare(b.teamName)
  })
}

// ─── Sub-componentes ──────────────────────────────────────────────

function TeamLogo({ url, name, size = 18 }: { url: string | null; name: string; size?: number }) {
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

function StandingsTable({ standings, highlightTeamId }: { standings: TeamStanding[]; highlightTeamId: string }) {
  const cell = 'px-1 py-1'
  return (
    <div className="rounded-lg overflow-hidden border border-border/50">
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
            const isQ  = i < 2
            const isHl = s.teamId === highlightTeamId
            return (
              <tr key={s.teamId} className={`border-t border-border/30 ${isHl ? 'bg-brand/10' : isQ ? 'bg-green-500/5' : ''}`}>
                <td className={`${cell} text-center`}>
                  <span className={`text-[10px] font-bold ${isQ ? 'text-green-400' : 'text-muted'}`}>{i + 1}</span>
                </td>
                <td className={cell}>
                  <div className="flex items-center gap-1">
                    <TeamLogo url={s.logoUrl} name={s.teamName} size={14} />
                    <span className="text-text font-medium truncate max-w-[3.5rem]">{s.teamName}</span>
                  </div>
                </td>
                <td className={`${cell} text-center text-muted`}>{s.pj}</td>
                <td className={`${cell} text-center text-muted`}>{s.pg}</td>
                <td className={`${cell} text-center text-muted`}>{s.pe}</td>
                <td className={`${cell} text-center text-muted`}>{s.pp}</td>
                <td className={`${cell} text-center text-muted`}>{s.pj > 0 ? (s.gf - s.gc > 0 ? '+' : '') + (s.gf - s.gc) : '—'}</td>
                <td className={`${cell} text-center font-bold text-text`}>{s.pts}</td>
              </tr>
            )
          })}
          {standings.length === 0 && (
            <tr><td colSpan={8} className="px-2 py-4 text-center text-muted-dark text-xs">Sin datos aún</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────

export function TeamDetailSheet({ team, competitionId, seasonYear, competitionName, onClose }: TeamDetailInfo & { onClose: () => void }) {
  // Swipe / animation
  const [entered,  setEntered]  = useState(false)
  const [closing,  setClosing]  = useState(false)
  const [dragY,    setDragY]    = useState(0)
  const startYRef  = useRef(0)
  const dragging   = useRef(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 300)
  }
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

  // Data
  const [allMatches,   setAllMatches]   = useState<CompetitionMatch[]>([])
  const [dataLoading,  setDataLoading]  = useState(true)

  useEffect(() => {
    fetchMatchesByCompetition(competitionId, seasonYear)
      .then(setAllMatches)
      .catch(console.error)
      .finally(() => setDataLoading(false))
  }, [competitionId, seasonYear])

  const groupMatchesMap = groupByRealGroupName(allMatches)
  const groupEntry = [...groupMatchesMap.entries()].find(([, ms]) =>
    ms.some(m => m.home_team?.id === team.id || m.away_team?.id === team.id)
  )
  const groupName    = groupEntry?.[0] ?? null
  const groupMatches = groupEntry?.[1] ?? []
  const standings    = calcRealStandings(groupMatches)

  const last5 = allMatches
    .filter(m =>
      (m.home_team?.id === team.id || m.away_team?.id === team.id) &&
      FINAL.has(m.status) && m.home_score != null && m.away_score != null
    )
    .sort((a, b) => new Date(b.match_date!).getTime() - new Date(a.match_date!).getTime())
    .slice(0, 5)

  const nextMatch = allMatches
    .filter(m =>
      (m.home_team?.id === team.id || m.away_team?.id === team.id) &&
      ['NS', 'PST'].includes(m.status) &&
      m.match_date != null && new Date(m.match_date).getTime() > Date.now()
    )
    .sort((a, b) => new Date(a.match_date!).getTime() - new Date(b.match_date!).getTime())[0] ?? null

  function getResult(m: CompetitionMatch): 'G' | 'E' | 'P' {
    const isHome = m.home_team?.id === team.id
    const my  = isHome ? m.home_score! : m.away_score!
    const opp = isHome ? m.away_score! : m.home_score!
    return my > opp ? 'G' : my === opp ? 'E' : 'P'
  }

  // Header
  function Header() {
    return (
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <TeamLogo url={team.logo_url} name={team.name} size={38} />
        <div className="flex-1 min-w-0">
          <h2 className="text-text text-base font-bold leading-tight">{team.name}</h2>
          {competitionName && <p className="text-muted text-[11px] mt-0.5 truncate">{competitionName}</p>}
        </div>
      </div>
    )
  }

  // Body
  function Body() {
    if (dataLoading) return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={22} className="text-brand animate-spin" />
      </div>
    )

    return (
      <div className="overflow-y-auto px-5 py-4 space-y-5 pb-12" style={{ maxHeight: '70vh' }}>

        {groupName && standings.length > 0 && (
          <div>
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-2">{groupName}</p>
            <StandingsTable standings={standings} highlightTeamId={team.id} />
          </div>
        )}

        <div>
          <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-2">Últimos 5 partidos</p>
          {last5.length === 0 ? (
            <p className="text-muted text-xs">Sin partidos disputados aún.</p>
          ) : (
            <div className="space-y-2">
              {last5.map(m => {
                const result   = getResult(m)
                const isHome   = m.home_team?.id === team.id
                const opp      = isHome ? m.away_team : m.home_team
                const myScore  = isHome ? m.home_score! : m.away_score!
                const oppScore = isHome ? m.away_score! : m.home_score!
                const dateStr  = m.match_date
                  ? new Date(m.match_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                  : null
                return (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      result === 'G' ? 'bg-green-500/20 text-green-400' :
                      result === 'E' ? 'bg-yellow-500/20 text-yellow-400' :
                                       'bg-red-500/20 text-red-400'
                    }`}>{result}</span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <TeamLogo url={opp?.logo_url ?? null} name={opp?.name ?? '?'} size={16} />
                      <span className="text-text text-xs truncate">{opp?.name ?? '—'}</span>
                    </div>
                    {dateStr && <span className="text-muted-dark text-[10px] shrink-0">{dateStr}</span>}
                    <span className="text-muted text-xs font-mono shrink-0">{myScore}–{oppScore}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {nextMatch && (
          <div>
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wider mb-2">Próximo partido</p>
            <div className="bg-elevated rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <TeamLogo url={nextMatch.home_team?.logo_url ?? null} name={nextMatch.home_team?.name ?? '?'} size={18} />
                  <span className="text-text text-xs font-medium truncate">{nextMatch.home_team?.name}</span>
                </div>
                <span className="text-muted text-xs shrink-0">vs</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <TeamLogo url={nextMatch.away_team?.logo_url ?? null} name={nextMatch.away_team?.name ?? '?'} size={18} />
                  <span className="text-text text-xs font-medium truncate">{nextMatch.away_team?.name}</span>
                </div>
              </div>
              {nextMatch.match_date && (
                <p className="text-muted text-[11px] text-center">
                  {new Date(nextMatch.match_date).toLocaleString('es-AR', {
                    weekday: 'short', day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false,
                  })}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={handleClose} />

      {/* Mobile: bottom sheet */}
      <div
        style={sheetStyle}
        className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl shadow-2xl will-change-transform touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <Header />
        <Body />
      </div>

      {/* Desktop: modal */}
      <div className="hidden sm:flex fixed inset-0 z-50 items-center justify-center p-4">
        <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <Header />
          <Body />
          <div className="px-5 py-4 border-t border-border flex justify-end">
            <button onClick={onClose} className="btn-primary px-8">Aceptar</button>
          </div>
        </div>
      </div>
    </>
  )
}
