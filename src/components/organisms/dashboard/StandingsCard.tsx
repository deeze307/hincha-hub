import { MOCK_STANDINGS } from '../../../data/mockDashboard'

export default function StandingsCard() {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="text-text text-sm font-semibold">Tabla de posiciones</p>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['#', 'Jugador', 'Pts', 'PJ', 'Efectividad'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] text-muted font-semibold uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_STANDINGS.map(p => (
              <tr
                key={p.pos}
                className={`border-b border-border/40 last:border-0 ${p.isMe ? 'bg-brand/10' : 'hover:bg-elevated'}`}
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
                <td className="px-4 py-3 text-text text-sm">{p.eff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-border">
        <a href="/ranking" className="text-brand text-sm font-semibold hover:underline">Ver ranking completo</a>
      </div>
    </div>
  )
}
