import { RefreshCw, Check, X } from 'lucide-react'

/* ── Team Badge ─────────────────────────────────────────────── */
const TEAMS: Record<string, { bg: string; text: string; border: string }> = {
  racing:        { bg: '#5DA8D0', text: '#fff',    border: '#fff' },
  boca:          { bg: '#003DA5', text: '#FFC200', border: '#FFC200' },
  river:         { bg: '#CC1421', text: '#fff',    border: '#fff' },
  independiente: { bg: '#CC0000', text: '#fff',    border: '#fff' },
  'san lorenzo': { bg: '#1C4B9C', text: '#fff',    border: '#CC1421' },
  huracán:       { bg: '#1A2A6E', text: '#fff',    border: '#fff' },
  talleres:      { bg: '#004FA2', text: '#fff',    border: '#fff' },
  belgrano:      { bg: '#00529B', text: '#FFC200', border: '#FFC200' },
}

function TeamBadge({ name, size = 30 }: { name: string; size?: number }) {
  const key = name.toLowerCase()
  const t = Object.entries(TEAMS).find(([k]) => key.includes(k))?.[1]
    ?? { bg: '#1E243B', text: '#AAB3C5', border: '#2A3352' }
  const abbr = name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold select-none"
      style={{
        width: size, height: size,
        background: t.bg, color: t.text,
        fontSize: size * 0.31,
        boxShadow: `0 0 0 2px ${t.border}33`,
      }}
    >
      {abbr}
    </div>
  )
}

/* ── Mock data ──────────────────────────────────────────────── */
const MATCHES = [
  { id: 1, home: 'Racing',      away: 'Boca',          time: '21:00', date: '24/05' },
  { id: 2, home: 'River',       away: 'Independiente', time: '15:30', date: '25/05' },
  { id: 3, home: 'San Lorenzo', away: 'Huracán',       time: '19:00', date: '26/05' },
  { id: 4, home: 'Talleres',    away: 'Belgrano',      time: '20:30', date: '26/05' },
]

const LEAGUES = [
  { name: 'Liga de Amigos',    pos: 2,  icon: '🏅' },
  { name: 'Copa Hincha Hub',   pos: 15, icon: '🏆' },
  { name: 'Familia Futbolera', pos: 1,  icon: '⭐' },
]

const ACTIVITY = [
  { text: 'Martín acertó el resultado de Racing vs Boca',  time: 'Hace 10 min' },
  { text: 'Sofi sumó 15 pts en la fecha 14',               time: 'Hace 35 min' },
  { text: 'Se creó la liga "Amigos del Fútbol"',           time: 'Hace 1 hora'  },
]

const STANDINGS = [
  { pos: 1, name: 'Martín', pts: 1234, pj: 14, pg: 9, pe: 3, pp: 2, eff: '58.3%' },
  { pos: 2, name: 'Sofi',   pts: 1198, pj: 14, pg: 8, pe: 2, pp: 4, eff: '54.8%' },
  { pos: 3, name: 'Diego',  pts: 1150, pj: 14, pg: 8, pe: 2, pp: 4, eff: '47.9%', isMe: true },
  { pos: 4, name: 'Nico',   pts: 1120, pj: 14, pg: 7, pe: 3, pp: 4, eff: '46.2%' },
]

const RECENT_PREDS = [
  { home: 'Racing',      away: 'Boca',          score: '2 - 1', correct: true,  date: '25/05' },
  { home: 'River',       away: 'Independiente', score: '1 - 1', correct: true,  date: '25/05' },
  { home: 'San Lorenzo', away: 'Huracán',       score: '0 - 1', correct: false, date: '24/05' },
]

/* ── Dashboard ──────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="p-6 space-y-5">
      <h1 className="text-text text-xl font-semibold tracking-tight">Dashboard</h1>

      {/* ── Fila 1 — grid 12 columnas ── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Próxima fecha — 3 cols */}
        <div className="col-span-3 card p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Próxima fecha</span>
            <RefreshCw size={13} className="text-muted hover:text-brand cursor-pointer transition-colors" />
          </div>

          <div>
            <p className="text-text text-2xl font-bold tracking-tight">Fecha 15</p>
            <p className="text-muted text-xs mt-1 flex items-center gap-1.5">
              <span>⚽</span> Liga Profesional
            </p>
          </div>

          <div>
            <p className="text-muted-dark text-[10px] font-semibold uppercase tracking-widest mb-3">Faltan:</p>
            <div className="grid grid-cols-3 gap-2">
              {[['02','DÍAS'],['14','HS'],['36','MIN']].map(([v,l]) => (
                <div key={l} className="bg-elevated rounded-xl py-3 text-center">
                  <p className="text-text text-2xl font-bold leading-none">{v}</p>
                  <p className="text-muted text-[9px] font-semibold uppercase mt-1.5">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <a href="/partidos" className="btn-primary text-center mt-auto">Ver partidos</a>
        </div>

        {/* Partidos de la fecha — 4 cols */}
        <div className="col-span-4 card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Partidos de la fecha</span>
            <a href="/partidos" className="text-brand text-xs font-semibold hover:underline">Ver todos</a>
          </div>

          <div className="flex-1 space-y-1">
            {MATCHES.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
                {/* Fecha + hora */}
                <div className="text-center shrink-0 w-10">
                  <p className="text-muted text-[10px] font-medium leading-none">{m.date}</p>
                  <p className="text-muted-dark text-[10px] mt-0.5">{m.time}</p>
                </div>
                {/* Equipos */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <TeamBadge name={m.home} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-text text-[13px] font-semibold leading-tight">
                      {m.home} <span className="text-muted-dark font-normal text-xs">vs</span> {m.away}
                    </p>
                  </div>
                  <TeamBadge name={m.away} size={28} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mis ligas — 2 cols */}
        <div className="col-span-2 card p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Mis ligas</span>
            <a href="/ligas" className="text-brand text-xs font-semibold hover:underline">Ver todas</a>
          </div>

          <div className="flex-1 space-y-1">
            {LEAGUES.map(l => (
              <div key={l.name} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
                <div className="w-9 h-9 rounded-xl bg-elevated flex items-center justify-center text-lg shrink-0">
                  {l.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text text-sm font-medium truncate leading-tight">{l.name}</p>
                  <p className="text-muted text-[11px] mt-0.5">Posición</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(255,116,3,0.4)]">
                  <span className="text-white text-[11px] font-bold">#{l.pos}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actividad reciente — 3 cols */}
        <div className="col-span-3 card p-6 flex flex-col gap-4">
          <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Actividad reciente</span>

          <div className="flex-1 space-y-4">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-brand" />
                </div>
                <div>
                  <p className="text-text text-[13px] leading-snug">{a.text}</p>
                  <p className="text-muted-dark text-[11px] mt-1">{a.time}</p>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-secondary w-full text-[13px] mt-auto">Ver toda la actividad</button>
        </div>
      </div>

      {/* ── Fila 2 — 3 columnas iguales ── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Tabla de posiciones — 4 cols */}
        <div className="col-span-4 card flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-text text-sm font-semibold">Tabla de posiciones (General)</p>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['#','Jugador','Pts','PJ','PG','PE','PP','Efectividad'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] text-muted font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STANDINGS.map(p => (
                  <tr
                    key={p.pos}
                    className={`border-b border-border/40 last:border-0 transition-colors ${p.isMe ? 'bg-brand/10' : 'hover:bg-elevated'}`}
                  >
                    <td className="px-4 py-3 text-muted text-sm font-mono">{p.pos}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${p.isMe ? 'bg-brand text-white' : 'bg-elevated text-muted'}`}>
                          {p.name[0]}
                        </div>
                        <span className={`text-sm font-medium ${p.isMe ? 'text-brand' : 'text-text'}`}>{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text text-sm font-semibold">{p.pts.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted text-sm">{p.pj}</td>
                    <td className="px-4 py-3 text-muted text-sm">{p.pg}</td>
                    <td className="px-4 py-3 text-muted text-sm">{p.pe}</td>
                    <td className="px-4 py-3 text-muted text-sm">{p.pp}</td>
                    <td className="px-4 py-3 text-text text-sm">{p.eff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-border">
            <a href="/ranking" className="text-brand text-sm font-semibold hover:underline">Ver ranking completo</a>
          </div>
        </div>

        {/* Predicciones recientes — 4 cols */}
        <div className="col-span-4 card p-6 flex flex-col gap-4">
          <p className="text-text text-sm font-semibold">Predicciones recientes</p>

          <div className="flex-1 space-y-1">
            {RECENT_PREDS.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-3.5 border-b border-border/50 last:border-0">
                <TeamBadge name={p.home} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-text text-[13px] font-medium">{p.home} vs {p.away}</p>
                </div>
                <span className="text-text text-[15px] font-bold shrink-0">{p.score}</span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${p.correct ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {p.correct
                    ? <Check size={13} className="text-green-400" />
                    : <X size={13} className="text-red-400" />}
                </div>
                <span className="text-muted-dark text-xs shrink-0 w-10 text-right">{p.date}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto">
            <a href="/predecir" className="text-brand text-sm font-semibold hover:underline">Ver historial completo</a>
          </div>
        </div>

        {/* Estadísticas personales — 4 cols */}
        <div className="col-span-4 card p-6 flex flex-col gap-5">
          <p className="text-text text-sm font-semibold">Estadísticas personales</p>

          <div className="grid grid-cols-2 gap-3 flex-1">
            {[
              { label: 'Predicciones', value: '142', emoji: '🎯' },
              { label: 'Aciertos',     value: '68',  emoji: '✅' },
              { label: 'Efectividad',  value: '47.9%', emoji: '📊' },
              { label: 'Mejor racha',  value: '6',   emoji: '🔥' },
            ].map(s => (
              <div key={s.label} className="bg-elevated rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center min-h-22.5">
                <span className="text-2xl">{s.emoji}</span>
                <p className="text-text text-xl font-bold leading-none">{s.value}</p>
                <p className="text-muted text-[11px] font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          <div>
            <a href="/estadisticas" className="text-brand text-sm font-semibold hover:underline">Ver estadísticas completas</a>
          </div>
        </div>
      </div>
    </div>
  )
}
