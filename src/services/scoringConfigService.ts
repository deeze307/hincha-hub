// @ts-nocheck
import { supabase } from '../lib/supabase'

export interface ScoringConfig {
  id:                  string
  early_cutoff_hours:  number
  modify_cutoff_hours: number   // umbral para ½ puntos al modificar una predicción
  lockout_hours:       number
  early_exact:         number
  early_winner_goals:  number
  early_winner:        number
  early_goals:         number
  late_exact:          number
  late_winner_goals:   number
  late_winner:         number
  late_goals:          number
}

export const DEFAULT_SCORING: ScoringConfig = {
  id:                  '',
  early_cutoff_hours:  24,
  modify_cutoff_hours: 8,
  lockout_hours:       1,
  early_exact:         12,
  early_winner_goals:  8,
  early_winner:        6,
  early_goals:         2,
  late_exact:          6,
  late_winner_goals:   4,
  late_winner:         3,
  late_goals:          1,
}

export async function fetchScoringConfig(): Promise<ScoringConfig> {
  const { data, error } = await supabase
    .from('scoring_config')
    .select('*')
    .limit(1)
    .single()

  if (error) return DEFAULT_SCORING
  return data as ScoringConfig
}

export async function updateScoringConfig(
  id: string,
  patch: Omit<ScoringConfig, 'id'>,
): Promise<void> {
  const { error } = await supabase
    .from('scoring_config')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}
