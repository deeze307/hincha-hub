import TeamBadge from '../../atoms/TeamBadge'
import { MOCK_MATCHES } from '../../../data/mockDashboard'

export default function MatchesCard() {
  return (
    <div className="lg:col-span-4 card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Partidos de la fecha</span>
        <a href="/partidos" className="text-brand text-xs font-semibold hover:underline">Ver todos</a>
      </div>

      <div className="flex-1 space-y-1">
        {MOCK_MATCHES.map(m => (
          <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
            <div className="text-center shrink-0 w-10">
              <p className="text-muted text-[10px] font-medium leading-none">{m.date}</p>
              <p className="text-muted-dark text-[10px] mt-0.5">{m.time}</p>
            </div>
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <TeamBadge name={m.home} size={28} />
              <p className="text-text text-[13px] font-semibold flex-1 truncate">
                {m.home} <span className="text-muted-dark font-normal text-xs">vs</span> {m.away}
              </p>
              <TeamBadge name={m.away} size={28} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
