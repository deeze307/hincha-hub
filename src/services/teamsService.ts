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
    .or(query.trim().split(/\s+/).map(w => `name.ilike.%${w}%`).join(','))
    .limit(limit)

  if (type) q = q.eq('type', type)

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export async function searchPlayers(
  query:         string,
  competitionId: string,
  limit =        10,
): Promise<PlayerOption[]> {
  const { data, error } = await supabase
    .from('players')
    .select(`
      id, name, photo_url, nationality, flag_url, position,
      team:team_id ( id, name, logo_url )
    `)
    .eq('competition_id', competitionId)

  if (error) throw error

  const words = query.trim().split(/\s+/).filter(Boolean).map(stripAccents)

  return (data ?? [] as unknown[])
    .filter((p: any) => words.every(w => stripAccents(p.name).includes(w)))
    .slice(0, limit) as unknown as PlayerOption[]
}
