// @ts-nocheck
import { supabase } from '../lib/supabase'
import type { CompetitionMatch } from './matchesService'

export interface TournamentTodayMatches {
  tournamentId:    string
  tournamentName:  string
  competitionLogo: string | null
  matches:         CompetitionMatch[]
}

// Reutilizable: devuelve los partidos de una fecha dada agrupados por torneo del usuario
export async function fetchMatchesForDate(date: Date): Promise<TournamentTodayMatches[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // 1. Torneos del usuario con info de competencia
  const { data: regs } = await supabase
    .from('tournament_registrations')
    .select(`
      tournament_id,
      tournaments (
        id, name, competition_id,
        competition:competitions ( name, logo_url, season_year )
      )
    `)
    .eq('user_id', user.id)

  if (!regs?.length) return []

  // Mapear competition_id → info del torneo (uno por competencia, sin duplicar)
  const byCompetition = new Map<string, {
    tournamentId:    string
    tournamentName:  string
    competitionLogo: string | null
    seasonYear:      number
  }>()

  for (const reg of regs) {
    const t = reg.tournaments as any
    if (!t?.competition_id || !t?.competition) continue
    if (byCompetition.has(t.competition_id)) continue
    byCompetition.set(t.competition_id, {
      tournamentId:    t.id,
      tournamentName:  t.name,
      competitionLogo: t.competition.logo_url ?? null,
      seasonYear:      t.competition.season_year ?? new Date().getFullYear(),
    })
  }

  if (byCompetition.size === 0) return []

  // 2. Partidos de la fecha solicitada (medianoche local → medianoche local del día siguiente)
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd   = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

  const { data: rawMatches } = await supabase
    .from('competition_matches')
    .select(`
      id, competition_id, season_year, match_date, status, round,
      home_score, away_score,
      home_team:home_team_id ( id, name, logo_url ),
      away_team:away_team_id ( id, name, logo_url )
    `)
    .in('competition_id', [...byCompetition.keys()])
    .gte('match_date', dayStart.toISOString())
    .lt('match_date',  dayEnd.toISOString())
    .order('match_date', { ascending: true })

  const matches = (rawMatches ?? []) as unknown as (CompetitionMatch & { competition_id: string })[]

  // 3. Agrupar por torneo, preservando el orden de inscripción
  const result: TournamentTodayMatches[] = []
  for (const [compId, info] of byCompetition) {
    const compMatches = matches.filter(
      m => m.competition_id === compId && m.season_year === info.seasonYear,
    )
    if (compMatches.length === 0) continue
    result.push({
      tournamentId:    info.tournamentId,
      tournamentName:  info.tournamentName,
      competitionLogo: info.competitionLogo,
      matches:         compMatches,
    })
  }

  return result
}
