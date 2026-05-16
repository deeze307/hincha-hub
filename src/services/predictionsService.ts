import { supabase } from '../lib/supabase'

// ─── Match predictions ──────────────────────────────────────────

export interface MatchPrediction {
  id?:              string
  user_id?:         string
  tournament_id:    string
  match_id:         string
  home_prediction:  number | null
  away_prediction:  number | null
  points_earned?:   number | null
}

export async function fetchUserPredictions(
  tournamentId: string,
): Promise<MatchPrediction[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('match_predictions')
    .select('id, tournament_id, match_id, home_prediction, away_prediction, points_earned')
    .eq('user_id', user.id)
    .eq('tournament_id', tournamentId)

  if (error) throw error
  return data ?? []
}

export async function saveMatchPredictions(
  tournamentId: string,
  predictions:  Array<{ match_id: string; home: number | null; away: number | null }>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const rows = predictions.map(p => ({
    user_id:          user.id,
    tournament_id:    tournamentId,
    match_id:         p.match_id,
    home_prediction:  p.home,
    away_prediction:  p.away,
    updated_at:       new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('match_predictions')
    .upsert(rows, { onConflict: 'user_id,tournament_id,match_id' })

  if (error) throw error
}

// ─── Bonus predictions ──────────────────────────────────────────

export interface BonusPrediction {
  id?:           string
  tournament_id: string
  type:          'champion' | 'top_scorer'
  rank:          1 | 2 | 3
  team_id?:      string | null
  player_id?:    string | null
  team_name?:    string | null
  player_name?:  string | null
  points_earned?: number | null
}

export async function fetchUserBonusPredictions(
  tournamentId: string,
): Promise<BonusPrediction[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('bonus_predictions')
    .select('id, tournament_id, type, rank, team_id, player_id, team_name, player_name, points_earned')
    .eq('user_id', user.id)
    .eq('tournament_id', tournamentId)

  if (error) throw error
  return data ?? []
}

export async function saveBonusPredictions(
  tournamentId: string,
  bonuses:      BonusPrediction[],
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const rows = bonuses.map(b => ({
    user_id:       user.id,
    tournament_id: tournamentId,
    type:          b.type,
    rank:          b.rank,
    team_id:       b.team_id ?? null,
    player_id:     b.player_id ?? null,
    team_name:     b.team_name ?? null,
    player_name:   b.player_name ?? null,
    updated_at:    new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('bonus_predictions')
    .upsert(rows, { onConflict: 'user_id,tournament_id,type,rank' })

  if (error) throw error
}

// ─── Helpers ────────────────────────────────────────────────────

export function calcPoints(
  homePred: number | null, awayPred: number | null,
  homeReal: number | null, awayReal: number | null,
): number | null {
  if (homePred == null || awayPred == null || homeReal == null || awayReal == null) return null
  if (homePred === homeReal && awayPred === awayReal) return 3
  const predSign = Math.sign(homePred - awayPred)
  const realSign = Math.sign(homeReal - awayReal)
  return predSign === realSign ? 1 : 0
}
