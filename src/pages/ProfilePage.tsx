import { Trophy, Target, Zap, Calendar, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const HISTORY = [
  { fecha: 'Fecha 14', pts: 210, correct: 9,  total: 12 },
  { fecha: 'Fecha 13', pts: 175, correct: 7,  total: 12 },
  { fecha: 'Fecha 12', pts: 140, correct: 6,  total: 12 },
]

export default function ProfilePage() {
  const { user } = useAuth()
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Usuario'
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const email = user?.email ?? ''

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-text text-xl font-semibold">Perfil</h1>
        <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-elevated border border-border text-muted hover:text-text transition-colors">
          <Settings size={16} />
        </button>
      </div>

      {/* Avatar + info */}
      <div className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-2xl">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-text font-semibold text-lg">{displayName}</h2>
          <p className="text-muted text-sm mt-0.5">{email}</p>
          <span className="inline-block mt-2 px-2.5 py-0.5 bg-brand/20 border border-brand/40 text-brand text-xs font-medium rounded-full">
            Hincha Pro
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Trophy size={18} className="text-brand" />}      label="Posición global"  value="#3"     sub="de 48 participantes" />
        <StatCard icon={<Target size={18} className="text-green-400" />}   label="Efectividad"      value="47.9%"  sub="promedio general" />
        <StatCard icon={<Zap size={18} className="text-yellow-400" />}     label="Puntos totales"   value="1.150"  sub="temporada actual" />
        <StatCard icon={<Calendar size={18} className="text-blue-400" />}  label="Fechas jugadas"   value="14/48"  sub="progreso del torneo" />
      </div>

      {/* Historial */}
      <section>
        <h2 className="text-text font-semibold mb-3">Historial de fechas</h2>
        <div className="space-y-2">
          {HISTORY.map(h => (
            <div key={h.fecha} className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm font-medium">{h.fecha}</p>
                <p className="text-muted text-xs">{h.correct}/{h.total} pronósticos correctos</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-brand font-bold text-lg">{h.pts} pts</p>
                <div className="h-1.5 w-20 bg-elevated rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full"
                    style={{ width: `${(h.correct / h.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA inscripción */}
      <div className="bg-elevated border border-border rounded-xl p-5 text-center">
        <p className="text-text font-semibold">¿Querés competir por el pozo?</p>
        <p className="text-muted text-sm mt-1">Inscribite al torneo pagando la entrada</p>
        <button className="mt-4 px-8 py-2.5 bg-brand hover:bg-brand-h text-white font-semibold rounded-lg transition-colors text-sm">
          Inscribirme — $2.000
        </button>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-muted text-xs font-medium">{label}</span>
      </div>
      <p className="text-text font-bold text-xl">{value}</p>
      <p className="text-muted text-xs mt-0.5">{sub}</p>
    </div>
  )
}
