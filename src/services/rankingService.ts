// @ts-nocheck
import { supabase } from '../lib/supabase'

export interface MyTournamentPosition {
  tournamentId:    string
  tournamentName:  string
  tournamentImage: string | null
  totalPts:        number
  rank:            number | null  // null = sin puntos aún
}

export async function fetchMyTournamentPositions(limit = 5): Promise<MyTournamentPosition[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: regs } = await supabase
    .from('tournament_registrations')
    .select('tournament_id, tournaments(id, name, image_url)')
    .eq('user_id', user.id)
    .limit(limit)

  if (!regs?.length) return []

  const tIds = regs.map((r: any) => r.tournament_id)

  // Puntos del usuario + todos los puntos de los demás (para calcular rank)
  const [{ data: myMatchPts }, { data: myBonusPts }, { data: allMatchPts }] = await Promise.all([
    supabase.from('match_predictions').select('tournament_id, points_earned')
      .eq('user_id', user.id).in('tournament_id', tIds),
    supabase.from('bonus_predictions').select('tournament_id, points_earned')
      .eq('user_id', user.id).in('tournament_id', tIds),
    supabase.from('match_predictions').select('user_id, tournament_id, points_earned')
      .in('tournament_id', tIds).not('points_earned', 'is', null),
  ])

  // Mis puntos por torneo
  const myPtsMap = new Map<string, number>()
  for (const p of (myMatchPts ?? [])) {
    myPtsMap.set(p.tournament_id, (myPtsMap.get(p.tournament_id) ?? 0) + (p.points_earned ?? 0))
  }
  for (const b of (myBonusPts ?? [])) {
    myPtsMap.set(b.tournament_id, (myPtsMap.get(b.tournament_id) ?? 0) + (b.points_earned ?? 0))
  }

  // Puntos de todos los usuarios por torneo (para calcular cuántos me superan)
  const allPtsMap = new Map<string, Map<string, number>>()
  for (const p of (allMatchPts ?? [])) {
    if (!allPtsMap.has(p.tournament_id)) allPtsMap.set(p.tournament_id, new Map())
    const tMap = allPtsMap.get(p.tournament_id)!
    tMap.set(p.user_id, (tMap.get(p.user_id) ?? 0) + (p.points_earned ?? 0))
  }

  const results: MyTournamentPosition[] = regs.map((reg: any) => {
    const tId    = reg.tournament_id
    const t      = reg.tournaments
    const myPts  = myPtsMap.get(tId) ?? 0
    let   rank: number | null = null

    if (myPts > 0) {
      const tMap   = allPtsMap.get(tId)
      const ahead  = tMap ? [...tMap.entries()].filter(([uid, pts]) => uid !== user.id && pts > myPts).length : 0
      rank = ahead + 1
    }

    return {
      tournamentId:    tId,
      tournamentName:  t?.name   ?? 'Torneo',
      tournamentImage: t?.image_url ?? null,
      totalPts:        myPts,
      rank,
    }
  })

  return results.sort((a, b) => {
    if (a.rank === null && b.rank === null) return 0
    if (a.rank === null) return 1
    if (b.rank === null) return -1
    return a.rank - b.rank
  })
}

export interface RankingEntry {
  rank:        number
  userId:      string
  displayName: string
  avatarUrl:   string | null
  matchPts:    number
  bonusPts:    number
  totalPts:    number
  matchesPlayed:  number
  matchesScored:  number  // predicciones con resultado conocido
}

export async function fetchTournamentRanking(tournamentId: string): Promise<RankingEntry[]> {
  // 1. Participantes del torneo
  const { data: registrations, error: rErr } = await supabase
    .from('tournament_registrations')
    .select('user_id')
    .eq('tournament_id', tournamentId)

  if (rErr) throw rErr
  if (!registrations?.length) return []

  const userIds = registrations.map((r: any) => r.user_id)

  // 1b. Perfiles por separado (evita depender de FK para join en PostgREST)
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', userIds)

  const profileMap = new Map((profileRows ?? []).map((p: any) => [p.id, p]))

  // 2. Puntos de partidos por usuario
  const { data: matchPreds, error: mpErr } = await supabase
    .from('match_predictions')
    .select('user_id, home_prediction, away_prediction, points_earned')
    .eq('tournament_id', tournamentId)
    .in('user_id', userIds)

  if (mpErr) throw mpErr

  // 3. Puntos bonus por usuario
  const { data: bonusPreds, error: bpErr } = await supabase
    .from('bonus_predictions')
    .select('user_id, points_earned')
    .eq('tournament_id', tournamentId)
    .in('user_id', userIds)

  if (bpErr) throw bpErr

  // 4. Agregar puntos por usuario
  const matchMap = new Map<string, { pts: number; played: number; scored: number }>()
  for (const p of (matchPreds ?? [])) {
    const cur = matchMap.get(p.user_id) ?? { pts: 0, played: 0, scored: 0 }
    const hasPred = p.home_prediction != null && p.away_prediction != null
    const hasResult = p.points_earned != null
    matchMap.set(p.user_id, {
      pts:    cur.pts    + (p.points_earned ?? 0),
      played: cur.played + (hasPred ? 1 : 0),
      scored: cur.scored + (hasResult ? 1 : 0),
    })
  }

  const bonusMap = new Map<string, number>()
  for (const b of (bonusPreds ?? [])) {
    bonusMap.set(b.user_id, (bonusMap.get(b.user_id) ?? 0) + (b.points_earned ?? 0))
  }

  // 5. Construir entradas sin rank aún
  const entries = registrations.map((r: any) => {
    const profile = profileMap.get(r.user_id) as { username: string | null; full_name: string | null; avatar_url: string | null } | null
    const mp      = matchMap.get(r.user_id) ?? { pts: 0, played: 0, scored: 0 }
    const bp      = bonusMap.get(r.user_id) ?? 0
    return {
      rank:          0,
      userId:        r.user_id,
      displayName:   profile?.full_name ?? profile?.username ?? 'Usuario',
      avatarUrl:     profile?.avatar_url ?? null,
      matchPts:      mp.pts,
      bonusPts:      bp,
      totalPts:      mp.pts + bp,
      matchesPlayed: mp.played,
      matchesScored: mp.scored,
    }
  })

  // 6. Ordenar: 0 pts → alfabético; >0 pts → por puntos DESC, empate = mismo rank
  entries.sort((a, b) => {
    if (a.totalPts === 0 && b.totalPts === 0) return a.displayName.localeCompare(b.displayName)
    if (a.totalPts === 0) return 1
    if (b.totalPts === 0) return -1
    if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts
    return a.displayName.localeCompare(b.displayName)
  })

  // 7. Asignar rank — empate de puntos = mismo número
  let rank = 1
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].totalPts !== entries[i - 1].totalPts) {
      rank = i + 1
    }
    entries[i].rank = entries[i].totalPts === 0 ? 0 : rank
  }

  return entries
}
