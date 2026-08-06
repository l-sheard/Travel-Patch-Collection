import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  isPasswordRecovery: boolean
  signInWithPassword: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>
  signUpWithPassword: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
  sendPasswordReset: (email: string, captchaToken?: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  updateEmail: (newEmail: string) => Promise<{ error: string | null }>
  cancelPasswordRecovery: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    isPasswordRecovery,
    async signInWithPassword(email, password, captchaToken) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      })
      return { error: error?.message ?? null }
    },
    async signUpWithPassword(email, password, captchaToken) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      })
      return {
        error: error?.message ?? null,
        needsEmailConfirmation: !error && !data.session,
      }
    },
    async sendPasswordReset(email, captchaToken) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
        captchaToken,
      })
      return { error: error?.message ?? null }
    },
    async updatePassword(newPassword) {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (!error) setIsPasswordRecovery(false)
      return { error: error?.message ?? null }
    },
    async updateEmail(newEmail) {
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      return { error: error?.message ?? null }
    },
    cancelPasswordRecovery() {
      setIsPasswordRecovery(false)
      void supabase.auth.signOut()
    },
    async signOut() {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
