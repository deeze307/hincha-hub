import { MOCK_LEAGUES } from '../../../data/mockDashboard'

export default function MyLeaguesCard() {
  return (
    <div className="lg:col-span-2 card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Mis ligas</span>
        <a href="/ligas" className="text-brand text-xs font-semibold hover:underline">Ver todas</a>
      </div>

      <div className="flex-1 space-y-1">
        {MOCK_LEAGUES.map(l => (
          <div key={l.name} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
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
  )
}
