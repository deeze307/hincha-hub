import { supabase } from '../lib/supabase'

export interface JoinRequest {
  id:            string
  tournament_id: string
  user_id:       string
  status:        'pending' | 'accepted' | 'rejected'
  created_at:    string
  resolved_at:   string | null
  // joins
  tournament?: { name: string } | null
  profile?:    { full_name: string | null; username: string | null } | null
}

export async function fetchPendingRequests(): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select(`
      id, tournament_id, user_id, status, created_at, resolved_at,
      tournament:tournaments(name),
      profile:profiles(full_name, username)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as JoinRequest[]
}

export async function fetchPendingRequestsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('join_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function acceptRequest(request: JoinRequest): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const now = new Date().toISOString()

  // 1. Marcar solicitud como aceptada
  const { error: reqErr } = await supabase
    .from('join_requests')
    .update({ status: 'accepted', resolved_at: now, resolved_by: user.id })
    .eq('id', request.id)

  if (reqErr) throw new Error(reqErr.message)

  // 2. Inscribir al usuario en el torneo
  const { error: regErr } = await supabase
    .from('tournament_registrations')
    .insert({ tournament_id: request.tournament_id, user_id: request.user_id })

  if (regErr && !regErr.message.includes('duplicate')) throw new Error(regErr.message)

  // 3. Enviar notificación al solicitante
  const tournamentName = request.tournament?.name ?? 'el torneo'
  await supabase.from('notifications').insert({
    user_id: request.user_id,
    type:    'league',
    text:    `Tu solicitud para unirte a "${tournamentName}" fue aceptada.`,
  })
}

export async function rejectRequest(request: JoinRequest): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const now = new Date().toISOString()

  const { error } = await supabase
    .from('join_requests')
    .update({ status: 'rejected', resolved_at: now, resolved_by: user.id })
    .eq('id', request.id)

  if (error) throw new Error(error.message)

  // Notificar rechazo
  const tournamentName = request.tournament?.name ?? 'el torneo'
  await supabase.from('notifications').insert({
    user_id: request.user_id,
    type:    'system',
    text:    `Tu solicitud para unirte a "${tournamentName}" fue rechazada.`,
  })
}
