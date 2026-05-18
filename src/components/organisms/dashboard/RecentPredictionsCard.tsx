import { Check, X } from 'lucide-react'
import TeamBadge from '../../atoms/TeamBadge'
import { MOCK_RECENT_PREDS } from '../../../data/mockDashboard'

export default function RecentPredictionsCard() {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <p className="text-text text-sm font-semibold">Predicciones recientes</p>

      <div className="flex-1 space-y-1">
        {MOCK_RECENT_PREDS.map((p, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
            <TeamBadge name={p.home} size={30} />
            <div className="flex-1 min-w-0">
              <p className="text-text text-[13px] font-medium truncate">{p.home} vs {p.away}</p>
            </div>
            <span className="text-text text-[15px] font-bold shrink-0">{p.score}</span>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${p.correct ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {p.correct
                ? <Check size={13} className="text-green-400" />
                : <X    size={13} className="text-red-400" />
              }
            </div>
            <span className="text-muted-dark text-xs shrink-0">{p.date}</span>
          </div>
        ))}
      </div>

      <a href="/predecir" className="text-brand text-sm font-semibold hover:underline mt-auto">
        Ver historial completo
      </a>
    </div>
  )
}
