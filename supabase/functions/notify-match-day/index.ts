// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const webpush = (await import('https://esm.sh/web-push@3.6.7')).default
    webpush.setVapidDetails(
      `mailto:${Deno.env.get('VAPID_EMAIL')}`,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    // Fecha de hoy en zona Argentina (UTC-3)
    const now = new Date()
    const argTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const today = argTime.toISOString().split('T')[0]

    // 1. Partidos de hoy que aún no empezaron
    const { data: matches, error: mErr } = await supabase
      .from('competition_matches')
      .select('id, competition_id, match_date')
      .gte('match_date', `${today}T00:00:00`)
      .lt('match_date', `${today}T23:59:59`)
      .in('status', ['NS', 'TBD', 'SUSP'])

    if (mErr) throw mErr
    if (!matches?.length) {
      return new Response(JSON.stringify({ ok: true, msg: 'Sin partidos hoy' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Torneos que usan esas competencias
    const competitionIds = [...new Set(matches.map((m: any) => m.competition_id).filter(Boolean))]

    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('id, name, competition_id')
      .in('competition_id', competitionIds)

    if (!tournaments?.length) {
      return new Response(JSON.stringify({ ok: true, msg: 'Sin torneos para esas competencias' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Usuarios inscriptos en esos torneos con push_enabled
    const tournamentIds = tournaments.map((t: any) => t.id)

    const { data: registrations } = await supabase
      .from('tournament_registrations')
      .select('user_id, tournament_id')
      .in('tournament_id', tournamentIds)

    if (!registrations?.length) {
      return new Response(JSON.stringify({ ok: true, msg: 'Sin participantes' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = [...new Set(registrations.map((r: any) => r.user_id))]

    // 4. Suscripciones push de usuarios con push_enabled = true
    const { data: enabledProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('push_enabled', true)
      .in('id', userIds)

    const enabledIds = (enabledProfiles ?? []).map((p: any) => p.id)

    if (!enabledIds.length) {
      return new Response(JSON.stringify({ ok: true, msg: 'Sin usuarios con push habilitado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', enabledIds)

    if (!subs?.length) {
      return new Response(JSON.stringify({ ok: true, msg: 'Sin suscripciones activas' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Armar mapa usuario → torneos con partidos hoy
    const compToTournament = new Map(tournaments.map((t: any) => [t.competition_id, t.name]))
    const matchesByComp = new Map<string, number>()
    for (const m of matches) {
      const count = matchesByComp.get(m.competition_id) ?? 0
      matchesByComp.set(m.competition_id, count + 1)
    }

    const userToTournaments = new Map<string, string[]>()
    for (const reg of registrations) {
      const tournament = tournaments.find((t: any) => t.id === reg.tournament_id)
      if (!tournament) continue
      const names = userToTournaments.get(reg.user_id) ?? []
      if (!names.includes(tournament.name)) names.push(tournament.name)
      userToTournaments.set(reg.user_id, names)
    }

    // 6. Enviar push personalizado a cada usuario
    const totalMatches = matches.length

    const results = await Promise.allSettled(
      subs.map((sub: any) => {
        const tournamentNames = userToTournaments.get(sub.user_id) ?? []
        const body = tournamentNames.length === 1
          ? `Hay ${totalMatches} partido${totalMatches !== 1 ? 's' : ''} hoy en "${tournamentNames[0]}". ¡Hacé tus predicciones!`
          : `Hay partidos hoy en ${tournamentNames.length} de tus torneos. ¡No te olvides de predecir!`

        return webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: '⚽ Partidos hoy', body, url: '/partidos' }),
        )
      })
    )

    // Limpiar suscripciones vencidas
    const expired = results
      .map((r, i) => ({ r, sub: subs[i] }))
      .filter(({ r }) => r.status === 'rejected' && (r.reason as any)?.statusCode === 410)
      .map(({ sub }) => sub.endpoint)

    if (expired.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expired)
    }

    const sent = results.filter(r => r.status === 'fulfilled').length

    return new Response(JSON.stringify({ ok: true, sent, total: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : typeof err === 'object' ? JSON.stringify(err) : String(err)
    console.error('notify-match-day error:', err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
