import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  sidebarCollapsed: boolean
  toggleSidebar:    () => void
  mobileMenuOpen:   boolean
  openMobileMenu:   () => void
  closeMobileMenu:  () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar:    () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileMenuOpen:   false,
      openMobileMenu:   () => set({ mobileMenuOpen: true }),
      closeMobileMenu:  () => set({ mobileMenuOpen: false }),
    }),
    { name: 'hinchahub-app', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) }
  )
)
