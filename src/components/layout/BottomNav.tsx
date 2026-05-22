import { NavLink } from 'react-router-dom'
import { Home, Trophy, BarChart3, TrendingUp } from 'lucide-react'

const NAV = [
  { to: '/',             icon: Home,       label: 'Inicio',       comingSoon: false },
  { to: '/torneos',      icon: Trophy,     label: 'Torneos',      comingSoon: false },
  { to: '/ranking',      icon: BarChart3,  label: 'Ranking',      comingSoon: true  },
  { to: '/estadisticas', icon: TrendingUp, label: 'Estadísticas', comingSoon: true  },
]

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border">
      <div className="flex">
        {NAV.map(({ to, icon: Icon, label, comingSoon }) => comingSoon ? (
          <div
            key={to}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted/40 relative"
          >
            <Icon size={21} strokeWidth={1.8} />
            <span>{label}</span>
            <span className="absolute top-1.5 right-[calc(50%-26px)] text-[7px] font-semibold bg-elevated border border-border text-muted-dark px-1 py-px rounded-full leading-none whitespace-nowrap">
              pronto
            </span>
          </div>
        ) : (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-brand' : 'text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={21} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div style={{ height: 'env(safe-area-inset-bottom)', background: '#15162E' }} />
    </nav>
  )
}
