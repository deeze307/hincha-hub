import { NavLink } from 'react-router-dom'
import { Home, Trophy, TrendingUp, Settings, Star, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useAuth } from '../../contexts/AuthContext'
import logoFull from '../../assets/images/logo2_transparente.png'

const NAV = [
  { to: '/',             icon: Home,       label: 'Inicio',        adminOnly: false, comingSoon: false },
  { to: '/torneos',      icon: Trophy,     label: 'Torneos',       adminOnly: false, comingSoon: false },
  { to: '/estadisticas', icon: TrendingUp, label: 'Estadísticas',  adminOnly: false, comingSoon: true  },
  { to: '/configuracion',       icon: Settings, label: 'Configuración',        adminOnly: true, comingSoon: false },
  { to: '/competiciones-admin', icon: Star,     label: 'Competiciones dest.', adminOnly: true, comingSoon: false },
]

function NavItems({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'superadmin'
  const visibleNav = NAV.filter(item => !item.adminOnly || isSuperAdmin)

  return (
    <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
      {visibleNav.map(({ to, icon: Icon, label, comingSoon }) => comingSoon ? (
        <div
          key={to}
          title={collapsed ? label : undefined}
          className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-[13px] font-medium text-muted/40 whitespace-nowrap cursor-default"
        >
          <Icon size={17} strokeWidth={1.8} className="shrink-0" />
          {!collapsed && (
            <span className="flex items-center gap-2 flex-1 min-w-0">
              <span className="truncate">{label}</span>
              <span className="text-[9px] font-semibold bg-elevated border border-border text-muted-dark px-1.5 py-px rounded-full leading-none shrink-0">
                pronto
              </span>
            </span>
          )}
        </div>
      ) : (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={collapsed ? label : undefined}
          onClick={onNavigate}
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
  )
}

export default function Sidebar() {
  const { sidebarCollapsed, mobileMenuOpen, closeMobileMenu } = useAppStore()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex flex-col shrink-0 bg-surface border-r border-border h-full overflow-hidden transition-all duration-300"
        style={{ width: sidebarCollapsed ? 56 : 208 }}
      >
        <NavItems collapsed={sidebarCollapsed} />
      </aside>

      {/* ── Mobile drawer ── */}
      <div
        className={`lg:hidden fixed inset-0 z-50 flex transition-all duration-300 ${
          mobileMenuOpen ? 'visible' : 'invisible'
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeMobileMenu}
        />

        {/* Panel */}
        <aside
          className={`relative flex flex-col w-64 h-full bg-surface border-r border-border shadow-elevated z-10 transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Header del drawer */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
            <img src={logoFull} alt="HinchaHub" className="h-8 w-auto object-contain" />
            <button
              onClick={closeMobileMenu}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <NavItems collapsed={false} onNavigate={closeMobileMenu} />
        </aside>
      </div>
    </>
  )
}
