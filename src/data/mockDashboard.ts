export const MOCK_MATCHES = [
  { id: 1, home: 'Racing',      away: 'Boca',          time: '21:00', date: '24/05' },
  { id: 2, home: 'River',       away: 'Independiente', time: '15:30', date: '25/05' },
  { id: 3, home: 'San Lorenzo', away: 'Huracán',       time: '19:00', date: '26/05' },
  { id: 4, home: 'Talleres',    away: 'Belgrano',      time: '20:30', date: '26/05' },
]

export const MOCK_LEAGUES = [
  { name: 'Liga de Amigos',    pos: 2,  icon: '🏅' },
  { name: 'Copa Hincha Hub',   pos: 15, icon: '🏆' },
  { name: 'Familia Futbolera', pos: 1,  icon: '⭐' },
]

export const MOCK_ACTIVITY = [
  { text: 'Martín acertó el resultado de Racing vs Boca',  time: 'Hace 10 min' },
  { text: 'Sofi sumó 15 pts en la fecha 14',               time: 'Hace 35 min' },
  { text: 'Se creó la liga "Amigos del Fútbol"',           time: 'Hace 1 hora'  },
]

export const MOCK_STANDINGS = [
  { pos: 1, name: 'Martín', pts: 1234, pj: 14, eff: '58.3%' },
  { pos: 2, name: 'Sofi',   pts: 1198, pj: 14, eff: '54.8%' },
  { pos: 3, name: 'Diego',  pts: 1150, pj: 14, eff: '47.9%', isMe: true },
  { pos: 4, name: 'Nico',   pts: 1120, pj: 14, eff: '46.2%' },
]

export const MOCK_RECENT_PREDS = [
  { home: 'Racing',      away: 'Boca',          score: '2 - 1', correct: true,  date: '25/05' },
  { home: 'River',       away: 'Independiente', score: '1 - 1', correct: true,  date: '25/05' },
  { home: 'San Lorenzo', away: 'Huracán',       score: '0 - 1', correct: false, date: '24/05' },
]

export const MOCK_PERSONAL_STATS = [
  { label: 'Predicciones', value: '142',   emoji: '🎯' },
  { label: 'Aciertos',     value: '68',    emoji: '✅' },
  { label: 'Efectividad',  value: '47.9%', emoji: '📊' },
  { label: 'Mejor racha',  value: '6',     emoji: '🔥' },
]
