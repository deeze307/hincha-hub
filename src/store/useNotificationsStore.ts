import { create } from 'zustand'
import {
  fetchRecentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationsService'

export type NotifType = 'prediction' | 'league' | 'system'

export interface Notification {
  id: string
  type: NotifType
  text: string
  read: boolean
  created_at: string
}

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  fetch: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    set({ loading: true })
    try {
      const data = await fetchRecentNotifications(4)
      set({
        notifications: data,
        unreadCount: data.filter((n: Notification) => !n.read).length,
      })
    } catch (err) {
      console.error('[notifications] fetch failed:', err)
    } finally {
      set({ loading: false })
    }
  },

  markAsRead: async (id) => {
    set(s => {
      const notifications = s.notifications.map(n => n.id === id ? { ...n, read: true } : n)
      return { notifications, unreadCount: notifications.filter(n => !n.read).length }
    })
    await markNotificationRead(id)
  },

  markAllAsRead: async () => {
    const ids = get().notifications.filter(n => !n.read).map(n => n.id)
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }))
    await markAllNotificationsRead(ids)
  },
}))
