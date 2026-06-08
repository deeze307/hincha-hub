// @ts-nocheck
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
  is_modified?:     boolean
  predicted_at?:    string | null
}

export async function fetchUserPredictions(
  tournamentId: string,
): Promise<MatchPrediction[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('match_predictions')
    .select('id, tournament_id, match_id, home_prediction, away_prediction, points_earned, is_modified, predicted_at')
    .eq('user_id', user.id)
    .eq('tournament_id', tournamentId)

  if (error) throw error
  return data ?? []
}

export async function fetchUserPredictionsForMatches(
  matchIds: string[],
): Promise<Map<string, { home: number; away: number }>> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !matchIds.length) return new Map()

  const { data } = await supabase
    .from('match_predictions')
    .select('match_id, home_prediction, away_prediction')
    .eq('user_id', user.id)
    .in('match_id', matchIds)
    .not('home_prediction', 'is', null)
    .not('away_prediction', 'is', null)

  const map = new Map<string, { home: number; away: number }>()
  for (const p of (data ?? [])) {
    map.set(p.match_id, { home: p.home_prediction, away: p.away_prediction })
  }
  return map
}

export async function saveMatchPredictions(
  tournamentId: string,
  predictions:  Array<{ match_id: string; home: number | null; away: number | null; is_new: boolean }>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const now = new Date().toISOString()
  const rows = predictions.map(p => ({
    user_id:          user.id,
    tournament_id:    tournamentId,
    match_id:         p.match_id,
    home_prediction:  p.home,
    away_prediction:  p.away,
    is_modified:      !p.is_new,   // false for first save, true for the one allowed modification
    predicted_at:     now,
    updated_at:       now,
  }))

  const { error } = await supabase
    .from('match_predictions')
    .upsert(rows, { onConflict: 'user_id,tournament_id,match_id' })

  if (error) throw error
}

// ─── Bonus predictions ──────────────────────────────────────────

export interface BonusPrediction {
  id?:               string
  tournament_id:     string
  type:              'champion' | 'top_scorer' | 'top_assists' | 'mvp' | 'best_goalkeeper'
  rank:              1 | 2 | 3
  team_id?:          string | null
  player_id?:        string | null
  team_name?:        string | null
  player_name?:      string | null
  team_logo_url?:    string | null
  player_photo_url?: string | null
  points_earned?:    number | null
  is_modified?:      boolean
}

export async function fetchUserBonusPredictions(
  tournamentId: string,
): Promise<BonusPrediction[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('bonus_predictions')
    .select('id, tournament_id, type, rank, team_id, player_id, team_name, player_name, points_earned, is_modified')
    .eq('user_id', user.id)
    .eq('tournament_id', tournamentId)

  if (error) throw error
  const bonuses = (data ?? []) as BonusPrediction[]
  if (!bonuses.length) return bonuses

  // Enriquecer con logos/fotos (no se guardan en bonus_predictions, se resuelven por id)
  const teamIds   = [...new Set(bonuses.map(b => b.team_id).filter(Boolean))] as string[]
  const playerIds = [...new Set(bonuses.map(b => b.player_id).filter(Boolean))] as string[]

  const [teamsRes, playersRes] = await Promise.all([
    teamIds.length
      ? supabase.from('teams').select('id, logo_url').in('id', teamIds)
      : Promise.resolve({ data: [] }),
    playerIds.length
      ? supabase.from('players').select('id, photo_url').in('id', playerIds)
      : Promise.resolve({ data: [] }),
  ])

  const teamLogos   = new Map((teamsRes.data   ?? []).map((t: any) => [t.id, t.logo_url]))
  const playerPhotos = new Map((playersRes.data ?? []).map((p: any) => [p.id, p.photo_url]))

  for (const b of bonuses) {
    if (b.team_id)   b.team_logo_url    = teamLogos.get(b.team_id) ?? null
    if (b.player_id) b.player_photo_url = playerPhotos.get(b.player_id) ?? null
  }

  return bonuses
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
    is_modified:   b.is_modified ?? false,
    updated_at:    new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('bonus_predictions')
    .upsert(rows, { onConflict: 'user_id,tournament_id,type,rank' })

  if (error) throw error
}

// ─── Helpers ────────────────────────────────────────────────────

// isEarly = prediction was made ≥ 24h before the match
export function calcPoints(
  homePred: number | null, awayPred: number | null,
  homeReal: number | null, awayReal: number | null,
  isEarly = true,
): number | null {
  if (homePred == null || awayPred == null || homeReal == null || awayReal == null) return null

  const exactHome  = homePred === homeReal
  const exactAway  = awayPred === awayReal

  if (exactHome && exactAway) return isEarly ? 12 : 6

  const predWinner = Math.sign(homePred - awayPred)
  const realWinner = Math.sign(homeReal - awayReal)
  const winnerMatch = predWinner === realWinner

  if (winnerMatch && (exactHome || exactAway)) return isEarly ? 8 : 4
  if (winnerMatch)                             return isEarly ? 6 : 3
  if (exactHome || exactAway)                  return isEarly ? 2 : 1
  return 0
}
