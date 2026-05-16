import { NavLink } from 'react-router-dom'
import { Home, Trophy, Calendar, Target, BarChart3, TrendingUp, Settings } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

const NAV = [
  { to: '/',             icon: Home,       label: 'Inicio'       },
  { to: '/torneos',      icon: Trophy,     label: 'Torneos'      },
  { to: '/partidos',     icon: Calendar,   label: 'Partidos'     },
  { to: '/predecir',     icon: Target,     label: 'Predecir'     },
  { to: '/ranking',      icon: BarChart3,  label: 'Ranking'      },
  { to: '/estadisticas', icon: TrendingUp, label: 'Estadísticas' },
  { to: '/configuracion',icon: Settings,   label: 'Configuración'},
]

export default function Sidebar() {
  const collapsed = useAppStore(s => s.sidebarCollapsed)

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 bg-surface border-r border-border h-full overflow-hidden transition-all duration-300"
      style={{ width: collapsed ? 56 : 208 }}
    >
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-brand text-white'
                  : 'text-muted hover:text-text hover:bg-elevated'
              }`
            }
          >
            <Icon size={17} strokeWidth={1.8} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
