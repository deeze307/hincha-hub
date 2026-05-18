import { MOCK_PERSONAL_STATS } from '../../../data/mockDashboard'

export default function PersonalStatsCard() {
  return (
    <div className="card p-5 flex flex-col gap-5">
      <p className="text-text text-sm font-semibold">Estadísticas personales</p>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {MOCK_PERSONAL_STATS.map(s => (
          <div key={s.label} className="bg-elevated rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center">
            <span className="text-2xl">{s.emoji}</span>
            <p className="text-text text-xl font-bold leading-none">{s.value}</p>
            <p className="text-muted text-[11px] font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <a href="/estadisticas" className="text-brand text-sm font-semibold hover:underline">
        Ver estadísticas completas
      </a>
    </div>
  )
}
