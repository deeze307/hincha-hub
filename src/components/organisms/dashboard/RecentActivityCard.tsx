import { MOCK_ACTIVITY } from '../../../data/mockDashboard'

export default function RecentActivityCard() {
  return (
    <div className="md:col-span-2 lg:col-span-4 card p-5 flex flex-col gap-4">
      <span className="text-muted text-[11px] font-semibold uppercase tracking-widest">Actividad reciente</span>

      <div className="flex-1 space-y-4">
        {MOCK_ACTIVITY.map((a, i) => (
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
  )
}
