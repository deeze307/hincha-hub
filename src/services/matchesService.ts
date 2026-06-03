import { supabase } from '../lib/supabase'

export interface Team {
  id:       string
  name:     string
  logo_url: string | null
  country:  string | null
  type:     'national' | 'club'
}

export interface CompetitionMatch {
  id:             string
  external_id:    number
  competition_id: string
  season_year:    number
  round:          string
  round_order:    number
  group_name:     string | null
  match_date:     string | null
  home_team:      Team | null
  away_team:      Team | null
  home_score:     number | null
  away_score:     number | null
  home_penalties: number | null
  away_penalties: number | null
  winner_team_id: string | null
  status:         string
  matchday:       number | null
  bracket_slot:   number | null
}

export async function fetchMatchesByCompetition(
  competitionId: string,
  seasonYear:    number,
): Promise<CompetitionMatch[]> {
  const { data, error } = await supabase
    .from('competition_matches')
    .select(`
      id, external_id, competition_id, season_year,
      round, round_order, group_name, match_date,
      home_score, away_score, home_penalties, away_penalties,
      winner_team_id, status, matchday, bracket_slot,
      home_team:home_team_id ( id, name, logo_url, country, type ),
      away_team:away_team_id ( id, name, logo_url, country, type )
    `)
    .eq('competition_id', competitionId)
    .eq('season_year', seasonYear)
    .order('round_order', { ascending: true })
    .order('match_date',  { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as CompetitionMatch[]
}

export function groupMatchesByGroup(
  matches: CompetitionMatch[],
): Map<string, CompetitionMatch[]> {
  const groups = new Map<string, CompetitionMatch[]>()
  for (const m of matches.filter(m => m.group_name != null)) {
    const key = m.group_name!
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }
  return groups
}

export function groupMatchesByRound(
  matches: CompetitionMatch[],
): Map<string, CompetitionMatch[]> {
  const rounds = new Map<string, CompetitionMatch[]>()
  for (const m of matches.filter(m => m.group_name == null && m.round_order > 1)) {
    if (!rounds.has(m.round)) rounds.set(m.round, [])
    rounds.get(m.round)!.push(m)
  }
  return rounds
}
