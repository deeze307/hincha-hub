// @ts-nocheck
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
    .select('id, tournament_id, user_id, status, created_at, resolved_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!data?.length) return []

  const tournamentIds = [...new Set(data.map((r: any) => r.tournament_id))]
  const userIds       = [...new Set(data.map((r: any) => r.user_id))]

  const [{ data: tournaments }, { data: profiles }] = await Promise.all([
    supabase.from('tournaments').select('id, name').in('id', tournamentIds),
    supabase.from('profiles').select('id, full_name, username').in('id', userIds),
  ])

  const tMap = new Map((tournaments ?? []).map((t: any) => [t.id, t]))
  const pMap = new Map((profiles   ?? []).map((p: any) => [p.id, p]))

  return data.map((r: any) => ({
    ...r,
    tournament: tMap.get(r.tournament_id) ?? null,
    profile:    pMap.get(r.user_id)       ?? null,
  })) as JoinRequest[]
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

  const { error } = await supabase.rpc('accept_join_request', {
    p_request_id:  request.id,
    p_resolved_by: user.id,
  })

  if (error) throw new Error(error.message)
}

export async function rejectRequest(request: JoinRequest): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await supabase.rpc('reject_join_request', {
    p_request_id:  request.id,
    p_resolved_by: user.id,
  })

  if (error) throw new Error(error.message)
}
