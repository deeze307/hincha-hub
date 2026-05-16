import { useRef, useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Bell, ChevronDown, PanelLeftClose, PanelLeftOpen, User, LogOut, Target, Users, Megaphone, Mail } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAppStore } from '../../store/useAppStore'
import { useNotificationsStore } from '../../store/useNotificationsStore'
import { useRequestsStore } from '../../store/useRequestsStore'
import type { Notification } from '../../store/useNotificationsStore'
import logoFull from '../../assets/images/logo2_transparente.png'
import isotipo   from '../../assets/images/isotipo.png'

function formatTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return 'Hace un momento'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} hs`
  return `Hace ${Math.floor(diff / 86400)} días`
}

export default function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const { notifications, unreadCount, fetch: fetchNotifs, markAsRead, markAllAsRead } = useNotificationsStore()
  const { count: requestsCount, fetchCount: fetchRequestsCount } = useRequestsStore()
  const { profile } = useAuth()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

  const [userOpen,  setUserOpen]  = useState(false)
  const [bellOpen,  setBellOpen]  = useState(false)
  const userRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Usuario'
  const fullName    = user?.user_metadata?.full_name ?? displayName
  const initials    = fullName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

  useEffect(() => {
    if (user) {
      fetchNotifs()
      if (isAdmin) fetchRequestsCount()
    }
  }, [user, isAdmin])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const recentNotifs = notifications.slice(0, 4)

  function handleBellOpen() {
    const opening = !bellOpen
    setBellOpen(opening)
    setUserOpen(false)
    if (opening) fetchNotifs()
  }

  function handleUserOpen() {
    setUserOpen(o => !o)
    setBellOpen(false)
  }

  function handleNotifClick(n: Notification) {
    markAsRead(n.id)
  }

  function handleSignOut() {
    setUserOpen(false)
    signOut()
  }

  function handleGoToProfile() {
    setUserOpen(false)
    navigate('/perfil')
  }

  const notifIcon: Record<Notification['type'], React.ReactNode> = {
    prediction: <Target  size={13} className="text-brand" />,
    league:     <Users   size={13} className="text-blue-400" />,
    system:     <Megaphone size={13} className="text-muted" />,
  }

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center px-4 gap-3 shrink-0 z-40">

      {/* Logo */}
      <div
        className="flex items-center shrink-0 overflow-hidden transition-all duration-300"
        style={{ width: sidebarCollapsed ? 56 : 156 }}
      >
        {sidebarCollapsed
          ? <img src={isotipo}   alt="HinchaHub" className="h-8 w-8 object-contain mx-auto" />
          : <img src={logoFull} alt="HinchaHub" className="h-9 w-auto object-contain" />
        }
      </div>

      {/* Toggle sidebar */}
      <button
        onClick={toggleSidebar}
        className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors shrink-0"
        title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {sidebarCollapsed
          ? <PanelLeftOpen  size={17} strokeWidth={1.8} />
          : <PanelLeftClose size={17} strokeWidth={1.8} />
        }
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-dark" />
        <input
          type="text"
          placeholder="Buscar torneos, usuarios..."
          className="w-full bg-elevated border border-border rounded-lg pl-9 pr-14 py-2 text-sm text-text placeholder:text-muted-dark focus:outline-none focus:border-brand transition-colors"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-dark bg-border px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </div>

      <div className="flex-1" />

      {/* ── Solicitudes (solo admins) ── */}
      {isAdmin && (
        <Link
          to="/solicitudes"
          className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-elevated transition-colors text-muted hover:text-text"
          title="Solicitudes pendientes"
        >
          <Mail size={18} />
          {requestsCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand flex items-center justify-center text-white text-[9px] font-bold">
              {requestsCount > 99 ? '99+' : requestsCount}
            </span>
          )}
        </Link>
      )}

      {/* ── Campanita ── */}
      <div className="relative" ref={bellRef}>
        <button
          onClick={handleBellOpen}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-elevated transition-colors text-muted hover:text-text"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />
          )}
        </button>

        {bellOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] w-80 bg-surface border border-border rounded-xl shadow-elevated overflow-hidden z-50">
            {/* Header del panel */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-text text-sm font-semibold">Notificaciones</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-brand text-xs font-medium hover:underline"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {/* Lista */}
            <div className="divide-y divide-border/50">
              {recentNotifs.length === 0 ? (
                <p className="px-4 py-6 text-center text-muted text-sm">Sin notificaciones</p>
              ) : recentNotifs.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-elevated transition-colors ${!n.read ? 'bg-brand/5' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center shrink-0 mt-0.5">
                    {notifIcon[n.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] leading-snug ${n.read ? 'text-muted' : 'text-text'}`}>
                      {n.text}
                    </p>
                    <p className="text-muted-dark text-[11px] mt-1">{formatTime(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5" />
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-2.5">
              <Link
                to="/notificaciones"
                onClick={() => setBellOpen(false)}
                className="block text-center text-brand text-sm font-semibold hover:underline"
              >
                Ver todas las notificaciones
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Usuario ── */}
      <div className="relative" ref={userRef}>
        <button
          onClick={handleUserOpen}
          className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-lg hover:bg-elevated transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-text text-sm font-semibold leading-none">{displayName}</p>
            <p className="text-muted text-[11px] mt-0.5">1.150 pts</p>
          </div>
          <ChevronDown
            size={14}
            className={`text-muted hidden sm:block transition-transform duration-200 ${userOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {userOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] w-52 bg-surface border border-border rounded-xl shadow-elevated overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-text text-sm font-semibold truncate">{fullName}</p>
              <p className="text-muted-dark text-xs truncate mt-0.5">{user?.email}</p>
            </div>
            <div className="py-1.5">
              <button
                onClick={handleGoToProfile}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-muted hover:text-text hover:bg-elevated transition-colors"
              >
                <User size={15} strokeWidth={1.8} />
                Mi perfil
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={15} strokeWidth={1.8} />
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
