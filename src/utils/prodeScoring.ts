import type { LucideIcon } from 'lucide-react'
import { Trophy, Star, Target, Award, Shield } from 'lucide-react'
import type { CompetitionMatch } from '../services/matchesService'
import type { BonusType } from '../services/tournamentsService'

// ─── Tipos ────────────────────────────────────────────────────────

export interface ScoreInput {
  home:         string
  away:         string
  home_orig:    string          // valor tal como se cargó/guardó en DB (para detectar cambios reales)
  away_orig:    string
  pts:          number | null  // points_earned from DB after scoring
  is_modified:  boolean        // true = permanently locked (used their one edit)
  exists_in_db: boolean        // false = never saved yet
  predicted_at: string | null  // ISO timestamp of the prediction
}

export type PredMap = Map<string, ScoreInput>  // match_id → scores

export type TeamRef = { id: string; name: string; logo_url: string | null }

export interface SelectedTeam   { id: string; name: string; logo_url: string | null }
export interface SelectedPlayer { id: string; name: string; photo_url: string | null; team: string | null }

export interface TeamStanding {
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

// ─── Constantes ───────────────────────────────────────────────────

export const LOCKOUT_HOURS = 1   // bloqueo 1h antes del partido
export const LATE_HOURS    = 24  // predicciones dentro de 24h → puntos reducidos

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE', 'INT'])

export const POSITION_ES: Record<string, string> = {
  'Goalkeeper': 'Arquero',
  'Defender':   'Defensor',
  'Midfielder': 'Mediocampista',
  'Attacker':   'Delantero',
  'Forward':    'Delantero',
}

export const RANK_META = [
  { rank: 1 as const, label: '1ª opción', pts: 10, medal: '🥇' },
  { rank: 2 as const, label: '2ª opción', pts: 5,  medal: '🥈' },
  { rank: 3 as const, label: '3ª opción', pts: 3,  medal: '🥉' },
]

export const BONUS_META: Record<BonusType, {
  label: string
  Icon:  LucideIcon
  kind:  'team' | 'player'
}> = {
  champion:        { label: 'Campeón del Torneo',   Icon: Trophy, kind: 'team'   },
  top_scorer:      { label: 'Goleador del Torneo',  Icon: Star,   kind: 'player' },
  top_assists:     { label: 'Asistidor del Torneo', Icon: Target, kind: 'player' },
  mvp:             { label: 'MVP del Torneo',        Icon: Award,  kind: 'player' },
  best_goalkeeper: { label: 'Mejor Arquero',         Icon: Shield, kind: 'player' },
}

// ─── Helpers de bloqueo / estado por partido ─────────────────────

export function isMatchLocked(match: CompetitionMatch): boolean {
  if (match.home_score != null || match.away_score != null) return true
  if (!match.match_date) return false
  return Date.now() >= new Date(match.match_date).getTime() - LOCKOUT_HOURS * 3_600_000
}

export function isMatchLate(match: CompetitionMatch, hours: number = LATE_HOURS): boolean {
  if (!match.match_date || isMatchLocked(match)) return false
  return Date.now() >= new Date(match.match_date).getTime() - hours * 3_600_000
}

export function isMatchLive(match: CompetitionMatch): boolean {
  return LIVE_STATUSES.has(match.status)
}

export function formatPredTime(iso: string): string {
  const d  = new Date(iso)
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${hh}:${mm} ${dd}/${mo}`
}

// ─── Cálculo de standings (puntos, GD, GF) ───────────────────────

export function calcGroupStandings(
  matches:  CompetitionMatch[],
  predMap:  PredMap,
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>()

  function ensure(team: CompetitionMatch['home_team']) {
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

    ensure(m.home_team)
    ensure(m.away_team)

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
