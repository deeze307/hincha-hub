// @ts-nocheck
import { supabase } from '../lib/supabase'

export async function setAvatarUrl(userId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function acceptTerms(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function updatePushEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ push_enabled: enabled })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function updateAlias(userId: string, alias: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ alias: alias.trim() || null })
    .eq('id', userId)
  if (error) {
    if (error.code === '23505') throw new Error('Ese alias ya está en uso, elegí otro')
    throw new Error(error.message)
  }
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/avatar.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (uploadErr) throw new Error(uploadErr.message)

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(path)

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)

  if (updateErr) throw new Error(updateErr.message)

  return publicUrl
}

const FINAL = new Set(['FT', 'AET', 'PEN'])

function direction(home: number, away: number): 'H' | 'D' | 'A' {
  if (home > away) return 'H'
  if (home === away) return 'D'
  return 'A'
}

export async function fetchUserStreaks(): Promise<{ current: number; best: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { current: 0, best: 0 }

  // 1. Todas las predicciones del usuario con score completo
  const { data: preds } = await supabase
    .from('match_predictions')
    .select('match_id, home_prediction, away_prediction')
    .eq('user_id', user.id)
    .not('home_prediction', 'is', null)
    .not('away_prediction', 'is', null)

  if (!preds?.length) return { current: 0, best: 0 }

  const matchIds = preds.map((p: any) => p.match_id)

  // 2. Resultados reales de esos partidos
  const { data: matches } = await supabase
    .from('competition_matches')
    .select('id, match_date, home_score, away_score, status')
    .in('id', matchIds)

  if (!matches?.length) return { current: 0, best: 0 }

  const matchMap = new Map(matches.map((m: any) => [m.id, m]))

  // 3. Solo predicciones de partidos finalizados y con resultado
  const finalized = preds
    .map((p: any) => {
      const m = matchMap.get(p.match_id)
      if (!m || !FINAL.has(m.status) || m.home_score == null || m.away_score == null) return null
      return {
        date:    m.match_date ?? '',
        correct: direction(p.home_prediction, p.away_prediction) === direction(m.home_score, m.away_score),
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))

  if (!finalized.length) return { current: 0, best: 0 }

  // 4. Calcular racha actual y mejor racha
  let best    = 0
  let streak  = 0
  for (const f of finalized) {
    if (f.correct) {
      streak++
      if (streak > best) best = streak
    } else {
      streak = 0
    }
  }

  return { current: streak, best }
}
