import { supabase } from '../lib/supabase'

export interface Competition {
  id:           string
  external_id:  number
  name:         string
  logo_url:     string | null
  country:      string
  country_flag: string | null
  season_year:  number
  start_date:   string
  end_date:     string | null
}

export async function fetchUpcomingCompetitions(): Promise<Competition[]> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('competitions')
    .select('id, external_id, name, logo_url, country, country_flag, season_year, start_date, end_date')
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Competition[]
}
