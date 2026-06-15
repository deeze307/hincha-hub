import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { setAvatarUrl } from '../services/profileService'

export type UserRole = 'user' | 'admin' | 'superadmin'

export interface Profile {
  id:           string
  username:     string | null
  full_name:    string | null
  alias:        string | null
  avatar_url:   string | null
  role:         UserRole
  push_enabled:      boolean
  terms_accepted_at: string | null
}

/** Alias → full_name → username → email prefix → 'Usuario' */
export function getDisplayName(
  profile: Pick<Profile, 'alias' | 'full_name' | 'username'> | null,
  email?: string | null,
): string {
  return profile?.alias ?? profile?.full_name ?? profile?.username ?? email?.split('@')[0] ?? 'Usuario'
}

interface AuthState {
  session: Session | null
  user:    User    | null
  profile: Profile | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  signIn:           (email: string, password: string) => Promise<{ error: string | null }>
  signUp:           (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut:          () => Promise<void>
  signInWithGoogle: () => Promise<void>
  refreshProfile:   () => Promise<void>
  resetPassword:    (email: string) => Promise<{ error: string | null }>
  updatePassword:   (newPassword: string) => Promise<{ error: string | null }>
  recovery:         boolean   // true cuando se entró por un enlace de recuperación
  clearRecovery:    () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null, user: null, profile: null, loading: true,
  })
  const [recovery, setRecovery] = useState(false)

  async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, alias, avatar_url, role, push_enabled, terms_accepted_at')
      .eq('id', userId)
      .single()
    return data as Profile | null
  }

  // Si el perfil no tiene avatar propio pero el usuario inició sesión con Google,
  // persistir la foto de Google en profiles para que se muestre en todos lados
  // (ranking incluido). Solo cuando avatar_url está vacío → no pisa fotos subidas a mano.
  async function syncGoogleAvatar(user: User, profile: Profile | null): Promise<Profile | null> {
    if (!profile || profile.avatar_url) return profile
    const googleAvatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null
    if (!googleAvatar) return profile
    await setAvatarUrl(user.id, googleAvatar)
    return { ...profile, avatar_url: googleAvatar }
  }

  async function applySession(session: Session | null) {
    if (!session?.user) {
      setState({ session: null, user: null, profile: null, loading: false })
      return
    }
    let profile = await fetchProfile(session.user.id)
    profile = await syncGoogleAvatar(session.user, profile)
    setState({ session, user: session.user, profile, loading: false })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      applySession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function refreshProfile() {
    if (!state.user) return
    const profile = await fetchProfile(state.user.id)
    setState(prev => ({ ...prev, profile }))
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?recovery=1`,
    })
    return { error: error?.message ?? null }
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  }

  function clearRecovery() { setRecovery(false) }

  return (
    <AuthContext.Provider value={{
      ...state, signIn, signUp, signOut, signInWithGoogle, refreshProfile,
      resetPassword, updatePassword, recovery, clearRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
