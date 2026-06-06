import type { CompetitionMatch } from '../services/matchesService'

// Liga de amistosos internacionales de selecciones en API-Football
export const FRIENDLIES_EXTERNAL_ID = 10

// Criterios para amistosos: solo desde abril 2026 (hora local), solo selecciones
// mayores (no juveniles), y solo si al menos un equipo está en el set de top.
export const FLAT_CUTOFF  = new Date(2026, 3, 1)  // April 1 en hora local (no UTC)
export const YOUTH_REGEXP = /\bU\d{2}\b/i

// Equipos del Mundial 2026 — todos top ~65 FIFA.
// Fuente: SELECT DISTINCT t.name, t.external_id FROM teams t JOIN competition_matches...
// Actualizar si cambia el ranking significativamente.
export const FIFA_TOP100_IDS = new Set<number>([
  25,   // Alemania
  23,   // Arabia Saudita
  1532, // Argelia
  26,   // Argentina
  20,   // Australia
  775,  // Austria
  1,    // Bélgica
  1113, // Bosnia y Herzegovina
  6,    // Brasil
  1533, // Cabo Verde
  5529, // Canadá
  1569, // Catar
  8,    // Colombia
  17,   // Corea del Sur
  1501, // Costa de Marfil
  3,    // Croacia
  5530, // Curaçao
  2382, // Ecuador
  32,   // Egipto
  1108, // Escocia
  9,    // España
  2384, // Estados Unidos
  2,    // Francia
  1504, // Ghana
  2386, // Haití
  10,   // Inglaterra
  22,   // Irán
  1567, // Iraq
  12,   // Japón
  1548, // Jordania
  31,   // Marruecos
  16,   // México
  1090, // Noruega
  4673, // Nueva Zelanda
  1118, // Países Bajos
  11,   // Panamá
  2380, // Paraguay
  27,   // Portugal
  1508, // R.D. del Congo
  770,  // República Checa
  13,   // Senegal
  1531, // Sudáfrica
  5,    // Suecia
  15,   // Suiza
  28,   // Túnez
  777,  // Türkiye
  7,    // Uruguay
  1568, // Uzbekistán
])

// True si un amistoso debe mostrarse: dentro de fecha, sin juveniles, y con al
// menos una selección relevante. El set vacío desactiva el filtro de ranking.
export function isRelevantFriendly(m: CompetitionMatch): boolean {
  if (m.match_date && new Date(m.match_date) < FLAT_CUTOFF) return false
  if (YOUTH_REGEXP.test(m.home_team?.name ?? '') || YOUTH_REGEXP.test(m.away_team?.name ?? '')) return false
  if (FIFA_TOP100_IDS.size > 0) {
    const homeId = m.home_team?.external_id
    const awayId = m.away_team?.external_id
    if (!FIFA_TOP100_IDS.has(homeId!) && !FIFA_TOP100_IDS.has(awayId!)) return false
  }
  return true
}
