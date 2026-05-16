import { supabase } from '../lib/supabase'
import type { Notification } from '../store/useNotificationsStore'

export async function fetchRecentNotifications(limit = 4): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, text, read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data as Notification[]
}

export interface NotificationsPage {
  data: Notification[]
  total: number
}

export async function fetchNotificationsPage(params: {
  page: number
  pageSize: number
  search: string
}): Promise<NotificationsPage> {
  const { page, pageSize, search } = params
  const from = page * pageSize
  const to   = from + pageSize - 1

  let query = supabase
    .from('notifications')
    .select('id, type, text, read, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (search.trim()) {
    query = query.ilike('text', `%${search.trim()}%`)
  }

  const { data, error, count } = await query

  if (error) throw new Error(error.message)
  return { data: (data ?? []) as Notification[], total: count ?? 0 }
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .in('id', ids)

  if (error) throw new Error(error.message)
}
