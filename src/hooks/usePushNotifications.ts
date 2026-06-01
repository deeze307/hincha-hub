// @ts-nocheck
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const array   = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) array[i] = rawData.charCodeAt(i)
  return array.buffer
}

export type PushPermission = 'default' | 'granted' | 'denied'

export function usePushNotifications() {
  const isSupported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window

  const [permission, setPermission] = useState<PushPermission>(
    isSupported ? (Notification.permission as PushPermission) : 'denied'
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    if (!isSupported) return
    checkSubscription()
  }, [isSupported])

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch {
      setSubscribed(false)
    }
  }

  async function subscribe() {
    if (!isSupported) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm as PushPermission)
      if (perm !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const json  = sub.toJSON()
      const keys  = json.keys as { p256dh: string; auth: string }

      const { error: upsertErr } = await supabase.from('push_subscriptions').upsert(
        { user_id: user.id, endpoint: json.endpoint!, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'user_id,endpoint' }
      )

      if (upsertErr) {
        console.error('Push subscription upsert error:', upsertErr)
        throw upsertErr
      }

      setSubscribed(true)
    } catch (err) {
      console.error('Push subscribe error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    if (!isSupported) return
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    } finally {
      setLoading(false)
    }
  }

  return { isSupported, permission, subscribed, loading, subscribe, unsubscribe }
}
