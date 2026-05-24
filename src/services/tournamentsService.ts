// @ts-nocheck
import { supabase } from '../lib/supabase'

export type BonusType = 'champion' | 'top_scorer' | 'top_assists' | 'mvp' | 'best_goalkeeper'

export const ALL_BONUS_TYPES: BonusType[] = [
  'champion', 'top_scorer', 'top_assists', 'mvp', 'best_goalkeeper',
]

export const BONUS_TYPE_LABELS: Record<BonusType, string> = {
  champion:        'Campeón del Torneo',
  top_scorer:      'Goleador del Torneo',
  top_assists:     'Asistidor del Torneo',
  mvp:             'MVP del Torneo',
  best_goalkeeper: 'Mejor Arquero',
}

export interface ProdeConfig {
  direct_qualifiers: number
  best_third_count:  number
  has_knockout:      boolean
  has_bonus:         boolean
  bonus_types:       BonusType[]
  tiebreakers:       string[]
}

export const DEFAULT_PRODE_CONFIG: ProdeConfig = {
  direct_qualifiers: 2,
  best_third_count:  0,
  has_knockout:      true,
  has_bonus:         true,
  bonus_types:       ['champion', 'top_scorer'],
  tiebreakers:       ['points', 'gd', 'gf', 'h2h'],
}

export interface Tournament {
  id:                  string
  name:                string
  description:         string | null
  image_url:           string | null
  access_type:         'open' | 'request'
  max_participants:    number | null
  status:              'upcoming' | 'active' | 'finished'
  created_by:          string
  competition_id:      string | null
  team_type:           'national' | 'club'
  prode_config:        ProdeConfig | null
  prediction_deadline: string | null
  created_at:          string
  updated_at:          string
  is_hidden:           boolean
  // joins
  competition?:    { name: string; logo_url: string | null; country: string } | null
  participant_count?: number
  is_registered?:  boolean
  has_pending_request?: boolean
}

export interface CreateTournamentData {
  name:                string
  description:         string
  competition_id:      string | null
  access_type:         'open' | 'request'
  max_participants:    number | null
  image_file:          File | null
  team_type:           'national' | 'club'
  prode_config:        ProdeConfig
  prediction_deadline: string | null
}

export interface UpdateTournamentData {
  name:         string
  description:  string
  image_file:   File | null
  image_url:    string | null
  is_hidden?:   boolean
  prode_config?: ProdeConfig
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('tournaments')
    .select(`
      id, name, description, image_url, access_type,
      max_participants, status, created_by, competition_id,
      team_type, prode_config, prediction_deadline,
      created_at, updated_at, is_hidden,
      competition:competitions(name, logo_url, country, season_year),
      participant_count:tournament_registrations(count)
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const tournaments = (data ?? []) as any[]

  let isSuperAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    isSuperAdmin = profile?.role === 'superadmin'
  }

  if (!user) {
    const visible = isSuperAdmin ? tournaments : tournaments.filter((t: any) => !t.is_hidden)
    return visible.map(t => ({
      ...t,
      participant_count:   t.participant_count?.[0]?.count ?? 0,
      is_registered:       false,
      has_pending_request: false,
    }))
  }

  const allIds = tournaments.map(t => t.id)

  // Traer inscripciones y solicitudes del usuario sobre TODOS los torneos
  // (incluyendo ocultos) para poder mostrar los ocultos en los que está inscripto
  const [{ data: regs }, { data: reqs }] = await Promise.all([
    supabase.from('tournament_registrations')
      .select('tournament_id')
      .eq('user_id', user.id)
      .in('tournament_id', allIds),
    supabase.from('join_requests')
      .select('tournament_id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .in('tournament_id', allIds),
  ])

  const regSet     = new Set((regs ?? []).map((r: any) => r.tournament_id))
  const pendingSet = new Set((reqs ?? []).map((r: any) => r.tournament_id))

  // Visible: no oculto, O el usuario está inscripto, O es superadmin
  const visible = isSuperAdmin
    ? tournaments
    : tournaments.filter((t: any) => !t.is_hidden || regSet.has(t.id))

  return visible.map(t => ({
    ...t,
    participant_count:   t.participant_count?.[0]?.count ?? 0,
    is_registered:       regSet.has(t.id),
    has_pending_request: pendingSet.has(t.id),
  }))
}

export async function createTournament(data: CreateTournamentData): Promise<Tournament> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  let image_url: string | null = null

  if (data.image_file) {
    image_url = await uploadTournamentImage(data.image_file, crypto.randomUUID())
  }

  const slug = data.name.trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-')
    + '-' + Date.now().toString(36)

  const { data: created, error } = await supabase
    .from('tournaments')
    .insert({
      name:                data.name.trim(),
      slug,
      description:         data.description.trim() || null,
      competition_id:      data.competition_id,
      access_type:         data.access_type,
      max_participants:    data.max_participants,
      image_url,
      created_by:          user.id,
      status:              'upcoming',
      team_type:           data.team_type,
      prode_config:        data.prode_config,
      prediction_deadline: data.prediction_deadline,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Auto-inscribir al creador como participante
  await supabase
    .from('tournament_registrations')
    .insert({ tournament_id: created.id, user_id: user.id })

  // Disparar sync-fixtures en background sin bloquear la respuesta
  supabase.functions.invoke('sync-fixtures').catch(() => {})

  return created as Tournament
}

export async function updateTournament(id: string, data: UpdateTournamentData): Promise<void> {
  let image_url = data.image_url

  if (data.image_file) {
    image_url = await uploadTournamentImage(data.image_file, id)
  }

  const patch: Record<string, any> = {
    name:        data.name.trim(),
    description: data.description.trim() || null,
    image_url,
    updated_at:  new Date().toISOString(),
  }
  if (data.is_hidden    !== undefined) patch.is_hidden    = data.is_hidden
  if (data.prode_config !== undefined) patch.prode_config = data.prode_config

  const { error } = await supabase
    .from('tournaments')
    .update(patch)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function joinTournament(tournamentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('tournament_registrations')
    .insert({ tournament_id: tournamentId, user_id: user.id })

  if (error) throw new Error(error.message)
}

export async function requestJoinTournament(tournamentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase
    .from('join_requests')
    .insert({ tournament_id: tournamentId, user_id: user.id })

  if (error) throw new Error(error.message)
}

async function uploadTournamentImage(file: File, tournamentId: string): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `${tournamentId}/cover.${ext}`

  const { error } = await supabase.storage
    .from('tournament-images')
    .upload(path, file, { upsert: true })

  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = supabase.storage
    .from('tournament-images')
    .getPublicUrl(path)

  return publicUrl
}
