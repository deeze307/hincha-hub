// @ts-nocheck
import { supabase } from '../lib/supabase'

// ─── Posiciones reales ────────────────────────────────────────────

export interface StandingRow {
  group_name:    string | null
  rank:          number
  team_name:     string | null
  team_logo_url: string | null
  played:        number
  win:           number
  draw:          number
  lose:          number
  goals_for:     number
  goals_against: number
  points:        number
}

export interface StandingGroup {
  group: string | null
  rows:  StandingRow[]
}

export async function fetchCompetitionStandings(
  competitionId: string,
  seasonYear:    number,
): Promise<StandingGroup[]> {
  const { data, error } = await supabase
    .from('competition_standings')
    .select('group_name, rank, team_name, team_logo_url, played, win, draw, lose, goals_for, goals_against, points')
    .eq('competition_id', competitionId)
    .eq('season_year', seasonYear)

  if (error || !data?.length) return []

  const groups = new Map<string, StandingRow[]>()
  for (const r of data as StandingRow[]) {
    const key = r.group_name ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, rows]) => ({
      group: group || null,
      rows:  rows.sort((x, y) => x.rank - y.rank),
    }))
}

// ─── Estadísticas de jugadores ────────────────────────────────────

export type StatType = 'goals' | 'assists' | 'yellow_cards' | 'red_cards'

export interface PlayerStatRow {
  rank:             number
  player_name:      string | null
  player_photo_url: string | null
  team_name:        string | null
  team_logo_url:    string | null
  value:            number
}

export type PlayerStats = Record<StatType, PlayerStatRow[]>

export async function fetchCompetitionPlayerStats(
  competitionId: string,
  seasonYear:    number,
): Promise<PlayerStats> {
  const empty: PlayerStats = { goals: [], assists: [], yellow_cards: [], red_cards: [] }

  const { data, error } = await supabase
    .from('competition_player_stats')
    .select('stat_type, rank, player_name, player_photo_url, team_name, team_logo_url, value')
    .eq('competition_id', competitionId)
    .eq('season_year', seasonYear)

  if (error || !data?.length) return empty

  const result: PlayerStats = { goals: [], assists: [], yellow_cards: [], red_cards: [] }
  for (const r of data as any[]) {
    if (result[r.stat_type as StatType]) result[r.stat_type as StatType].push(r)
  }
  for (const k of Object.keys(result) as StatType[]) {
    result[k].sort((a, b) => a.rank - b.rank)
  }
  return result
}
