// @ts-nocheck
import { supabase } from '../lib/supabase'

export interface Competition {
  id:            string
  external_id:   number
  name:          string
  logo_url:      string | null
  country:       string
  country_flag:  string | null
  season_year:   number
  start_date:    string
  end_date:      string | null
  featured:      boolean
  display_order: number
}

const COMP_FIELDS = 'id, external_id, name, logo_url, country, country_flag, season_year, start_date, end_date, featured, display_order'

export async function fetchUpcomingCompetitions(): Promise<Competition[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('competitions')
    .select(COMP_FIELDS)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('start_date', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Competition[]
}

export async function fetchFeaturedCompetitions(): Promise<Competition[]> {
  const { data, error } = await supabase
    .from('competitions')
    .select(COMP_FIELDS)
    .eq('featured', true)
    .order('display_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Competition[]
}

export async function fetchAllCompetitionsAdmin(): Promise<Competition[]> {
  const { data, error } = await supabase
    .from('competitions')
    .select(COMP_FIELDS)
    .order('featured', { ascending: false })
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Competition[]
}

export async function updateCompetitionFeatured(
  id:           string,
  featured:     boolean,
  displayOrder: number,
): Promise<void> {
  const { error, count } = await supabase
    .from('competitions')
    .update({ featured, display_order: displayOrder })
    .eq('id', id)
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  if (count === 0) throw new Error('Sin permisos para actualizar competiciones')
}
