import { NavLink } from 'react-router-dom'
import { Home, Trophy, BarChart3, TrendingUp } from 'lucide-react'

const NAV = [
  { to: '/',             icon: Home,       label: 'Inicio'       },
  { to: '/torneos',      icon: Trophy,     label: 'Torneos'      },
  { to: '/ranking',      icon: BarChart3,  label: 'Ranking'      },
  { to: '/estadisticas', icon: TrendingUp, label: 'Estadísticas' },
]

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface border-t border-border">
      <div className="flex">
        {NAV.map(({ to, icon: Icon, label }) => (
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
