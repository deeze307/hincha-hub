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

// Cache de jugadores por competición (una vez por sesión). El filtro por acentos
// se hace en cliente, así que necesitamos el padrón completo — y paginamos para
// evitar el límite implícito de 1000 filas de PostgREST (el Mundial supera 1400).
const playerCache = new Map<string, PlayerOption[]>()

async function fetchAllPlayers(competitionId: string): Promise<PlayerOption[]> {
  const cached = playerCache.get(competitionId)
  if (cached) return cached

  const all: PlayerOption[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('players')
      .select(`
        id, name, photo_url, nationality, flag_url, position,
        team:team_id ( id, name, logo_url )
      `)
      .eq('competition_id', competitionId)
      .range(from, from + 999)

    if (error) throw error
    if (!data?.length) break
    all.push(...(data as unknown as PlayerOption[]))
    if (data.length < 1000) break
  }

  playerCache.set(competitionId, all)
  return all
}

export async function searchPlayers(
  query:         string,
  competitionId: string,
  limit =        10,
): Promise<PlayerOption[]> {
  const players = await fetchAllPlayers(competitionId)
  const words   = query.trim().split(/\s+/).filter(Boolean).map(stripAccents)

  return players
    .filter(p => words.every(w => stripAccents(p.name).includes(w)))
    .slice(0, limit)
}
