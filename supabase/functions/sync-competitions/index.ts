import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apiFootballKey  = Deno.env.get('API_FOOTBALL_KEY')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Acepta year por body para testing; por defecto usa el año actual
    let targetYear = new Date().getFullYear()
    try {
      const body = await req.clone().json()
      if (body.year) targetYear = body.year
    } catch { /* body vacío */ }

    const currentYear = targetYear

    // Llamada a API-Football
    const res = await fetch(
      `https://v3.football.api-sports.io/leagues?season=${currentYear}`,
      { headers: { 'x-apisports-key': apiFootballKey } }
    )

    if (!res.ok) {
      throw new Error(`API-Football error: ${res.status} ${res.statusText}`)
    }

    const json    = await res.json()
    const leagues = json.response ?? []

    // Sincronizar todas las temporadas del año en curso (sin filtrar por fecha)
    const competitions = leagues
      .filter((entry: any) => {
        return entry.seasons?.find((s: any) => s.year === currentYear)
      })
      .map((entry: any) => {
        const season = entry.seasons.find((s: any) => s.year === currentYear)
        return {
          external_id:  entry.league.id,
          name:         entry.league.name,
          logo_url:     entry.league.logo,
          country:      entry.country.name,
          country_flag: entry.country.flag ?? null,
          season_year:  currentYear,
          start_date:   season.start,
          end_date:     season.end   ?? null,
          synced_at:    new Date().toISOString(),
        }
      })

    if (competitions.length > 0) {
      const { error } = await supabase
        .from('competitions')
        .upsert(competitions, { onConflict: 'external_id,season_year' })

      if (error) throw error
    }

    return new Response(
      JSON.stringify({ ok: true, synced: competitions.length, year: currentYear }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('sync-competitions error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
