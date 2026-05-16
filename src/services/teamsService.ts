import { supabase } from '../lib/supabase'

export interface TeamOption {
  id:       string
  name:     string
  logo_url: string | null
  country:  string | null
  type:     'national' | 'club'
}

export interface PlayerOption {
  id:          string
  name:        string
  photo_url:   string | null
  nationality: string | null
  flag_url:    string | null
  position:    string | null
  team:        { id: string; name: string; logo_url: string | null } | null
}

export async function searchTeams(
  query:   string,
  type?:   'national' | 'club',
  limit =  10,
): Promise<TeamOption[]> {
  let q = supabase
    .from('teams')
    .select('id, name, logo_url, country, type')
    .ilike('name', `%${query}%`)
    .limit(limit)

  if (type) q = q.eq('type', type)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function searchPlayers(
  query:         string,
  competitionId: string,   // filtra por competencia para evitar mezclar squads
  limit =        10,
): Promise<PlayerOption[]> {
  const { data, error } = await supabase
    .from('players')
    .select(`
      id, name, photo_url, nationality, flag_url, position,
      team:team_id ( id, name, logo_url )
    `)
    .eq('competition_id', competitionId)
    .ilike('name', `%${query}%`)
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as PlayerOption[]
}
