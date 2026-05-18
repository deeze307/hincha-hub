import { RefreshCw } from 'lucide-react'

export default function NextMatchCard() {
  return (
    <div className="lg:col-span-4 card p-5 flex flex-col gap-4">
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
          {[['02','DÍAS'],['14','HS'],['36','MIN']].map(([v, l]) => (
            <div key={l} className="bg-elevated rounded-xl py-3 text-center">
              <p className="text-text text-2xl font-bold leading-none">{v}</p>
              <p className="text-muted text-[9px] font-semibold uppercase mt-1.5">{l}</p>
            </div>
          ))}
        </div>
      </div>

      <a href="/partidos" className="btn-primary text-center mt-auto">Ver partidos</a>
    </div>
  )
}
