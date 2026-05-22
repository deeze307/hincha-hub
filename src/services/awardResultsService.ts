// @ts-nocheck
import { supabase } from '../lib/supabase'
import type { BonusType } from './tournamentsService'

export interface AwardResult {
  id:            string
  tournament_id: string
  award_type:    BonusType
  team_id:       string | null
  player_id:     string | null
  team_name:     string | null
  team_logo_url: string | null
  player_name:   string | null
  resolved_at:   string
}

export async function fetchAwardResults(tournamentId: string): Promise<AwardResult[]> {
  const { data, error } = await supabase
    .from('award_results')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  return data ?? []
}

export async function saveAwardResult(
  tournamentId: string,
  awardType:    BonusType,
  winner: {
    team_id?:       string | null
    player_id?:     string | null
    team_name?:     string | null
    team_logo_url?: string | null
    player_name?:   string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from('award_results')
    .upsert(
      {
        tournament_id: tournamentId,
        award_type:    awardType,
        team_id:       winner.team_id       ?? null,
        player_id:     winner.player_id     ?? null,
        team_name:     winner.team_name     ?? null,
        team_logo_url: winner.team_logo_url ?? null,
        player_name:   winner.player_name   ?? null,
        resolved_at:   new Date().toISOString(),
      },
      { onConflict: 'tournament_id,award_type' },
    )
  if (error) throw error
}

export async function deleteAwardResult(
  tournamentId: string,
  awardType:    BonusType,
): Promise<void> {
  const { error } = await supabase
    .from('award_results')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('award_type', awardType)
  if (error) throw error
}
