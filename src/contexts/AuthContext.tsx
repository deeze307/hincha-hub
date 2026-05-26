import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'user' | 'admin' | 'superadmin'

export interface Profile {
  id:         string
  username:   string | null
  full_name:  string | null
  alias:      string | null
  avatar_url: string | null
  role:       UserRole
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null, user: null, profile: null, loading: true,
  })

  async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, alias, avatar_url, role')
      .eq('id', userId)
      .single()
    return data as Profile | null
  }

  async function applySession(session: Session | null) {
    if (!session?.user) {
      setState({ session: null, user: null, profile: null, loading: false })
      return
    }
    const profile = await fetchProfile(session.user.id)
    setState({ session, user: session.user, profile, loading: false })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      options: { data: { full_name: fullName } },
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

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, signInWithGoogle, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
