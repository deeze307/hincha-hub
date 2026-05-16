import { Minus, Crown, ArrowUp, ArrowDown } from 'lucide-react'

const PLAYERS = [
  { pos: 1,  name: 'Martín G.',    pts: 1234, pj: 14, eff: '66.3%', trend: 'up'   },
  { pos: 2,  name: 'Sofi R.',      pts: 1198, pj: 14, eff: '54.8%', trend: 'up'   },
  { pos: 3,  name: 'Diego M.',     pts: 1150, pj: 14, eff: '47.9%', trend: 'up',  isMe: true },
  { pos: 4,  name: 'Nico P.',      pts: 1120, pj: 14, eff: '46.2%', trend: 'down' },
  { pos: 5,  name: 'Laura V.',     pts: 1090, pj: 14, eff: '44.1%', trend: 'same' },
  { pos: 6,  name: 'Sebas T.',     pts: 1055, pj: 14, eff: '42.8%', trend: 'down' },
  { pos: 7,  name: 'Ana B.',       pts: 1022, pj: 14, eff: '41.5%', trend: 'up'   },
  { pos: 8,  name: 'Rodrigo F.',   pts: 998,  pj: 14, eff: '40.2%', trend: 'same' },
]

const ME = PLAYERS.find(p => p.isMe)!

export default function RankingsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-text text-xl font-semibold">Ranking</h1>
        <p className="text-muted text-sm mt-0.5">Mundial 2026 · Fase de grupos</p>
      </div>

      {/* Mi posición */}
      <div className="bg-brand/10 border border-brand/30 rounded-xl p-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-brand flex items-center justify-center shrink-0">
          <span className="text-white font-bold">DM</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-text font-semibold">{ME.name}</p>
          <p className="text-muted text-xs">{ME.pj} fechas jugadas · {ME.eff} efectividad</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-brand font-black text-3xl leading-none">#{ME.pos}</p>
          <p className="text-text font-semibold text-sm mt-0.5">{ME.pts.toLocaleString()} pts</p>
        </div>
      </div>

      {/* Podio */}
      <div className="grid grid-cols-3 gap-3">
        {[PLAYERS[1], PLAYERS[0], PLAYERS[2]].map((p, i) => {
          const medals = ['🥈', '🥇', '🥉']
          const heights = ['pt-6', 'pt-0', 'pt-10']
          return (
            <div key={p.pos} className={`bg-surface border border-border rounded-xl flex flex-col items-center p-4 ${heights[i]}`}>
              <span className="text-3xl mb-2">{medals[i]}</span>
              <p className="text-text text-sm font-semibold">{p.name.split(' ')[0]}</p>
              <p className="text-brand text-xs font-bold mt-0.5">{p.pts.toLocaleString()} pts</p>
            </div>
          )
        })}
      </div>

      {/* Tabla */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_80px_48px_80px_32px] px-4 py-3 border-b border-border">
          {['#', 'Jugador', 'Puntos', 'PJ', 'Efect.', ''].map(h => (
            <span key={h} className="text-muted text-xs font-semibold">{h}</span>
          ))}
        </div>

        {PLAYERS.map(p => (
          <div
            key={p.pos}
            className={`grid grid-cols-[40px_1fr_80px_48px_80px_32px] px-4 py-3 items-center border-b border-border/40 last:border-0 ${
              p.isMe ? 'bg-brand/10' : 'hover:bg-elevated'
            }`}
          >
            <div>
              {p.pos <= 3
                ? <Crown size={14} className={p.pos === 1 ? 'text-yellow-400' : p.pos === 2 ? 'text-slate-300' : 'text-amber-600'} />
                : <span className="text-muted text-sm font-mono">{p.pos}</span>
              }
            </div>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${p.isMe ? 'bg-brand text-white' : 'bg-elevated text-muted'}`}>
                {p.name[0]}
              </div>
              <span className={`text-sm font-medium truncate ${p.isMe ? 'text-brand' : 'text-text'}`}>{p.name}</span>
            </div>
            <span className={`text-sm font-semibold ${p.isMe ? 'text-brand' : 'text-text'}`}>{p.pts.toLocaleString()}</span>
            <span className="text-muted text-sm">{p.pj}</span>
            <span className="text-text text-sm">{p.eff}</span>
            <div>
              {p.trend === 'up'   && <ArrowUp size={14} className="text-green-400" />}
              {p.trend === 'down' && <ArrowDown size={14} className="text-red-400" />}
              {p.trend === 'same' && <Minus size={14} className="text-muted" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
