// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, user_ids, broadcast, title, body, url } = await req.json()

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'title y body son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!user_id && !user_ids?.length && !broadcast) {
      return new Response(JSON.stringify({ error: 'Indicá user_id, user_ids o broadcast: true' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    webpush.setVapidDetails(
      `mailto:${Deno.env.get('VAPID_EMAIL')}`,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Construir query de suscripciones según el modo
    let subsQuery = supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth, profiles!inner(push_enabled)')

    if (broadcast) {
      // todos los que tengan push_enabled = true
      subsQuery = subsQuery.eq('profiles.push_enabled', true)
    } else if (user_ids?.length) {
      subsQuery = subsQuery
        .in('user_id', user_ids)
        .eq('profiles.push_enabled', true)
    } else {
      subsQuery = subsQuery
        .eq('user_id', user_id)
        .eq('profiles.push_enabled', true)
    }

    const { data: subs, error } = await subsQuery

    if (error) throw error
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({ title, body, url: url ?? '/' })

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
      )
    )

    // Limpiar suscripciones expiradas (410 Gone)
    const expired = results
      .map((r, i) => ({ r, sub: subs[i] }))
      .filter(({ r }) => r.status === 'rejected' && (r.reason as any)?.statusCode === 410)
      .map(({ sub }) => sub.endpoint)

    if (expired.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expired)
    }

    const sent = results.filter(r => r.status === 'fulfilled').length

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
