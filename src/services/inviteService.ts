import { supabase } from '../lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

interface InviteResolution {
  tournament_id:   string
  tournament_name: string
}

export async function createInviteLink(tournamentId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data, error } = await db
    .from('invite_links')
    .insert({ tournament_id: tournamentId, created_by: user.id })
    .select('token')
    .single()

  if (error) throw error
  return `${window.location.origin}/unirse/${data.token}`
}

export async function resolveInviteToken(token: string): Promise<InviteResolution | null> {
  const { data, error } = await db
    .from('invite_links')
    .select('tournament_id, expires_at, tournaments(name)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) return null
  return {
    tournament_id:   data.tournament_id,
    tournament_name: data.tournaments?.name ?? '',
  }
}
