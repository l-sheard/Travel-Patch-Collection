import { useState, type FormEvent } from 'react'
import { StampIcon } from '../components/layout/icons'
import { useAuth } from '../context/AuthProvider'

type Mode = 'sign-in' | 'sign-up'

export default function SignIn() {
  const { signInWithPassword, signUpWithPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    if (mode === 'sign-in') {
      const { error } = await signInWithPassword(email, password)
      if (error) setError(error)
    } else {
      const { error, needsEmailConfirmation } = await signUpWithPassword(email, password)
      if (error) {
        setError(error)
      } else if (needsEmailConfirmation) {
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('sign-in')
      }
    }

    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-3xl border-2 border-dashed border-teal/30 bg-white/60 p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 text-teal">
            <StampIcon className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-teal-dark">Travel Patches</h1>
          <p className="mt-1 text-sm text-ink/60">
            {mode === 'sign-in' ? 'Welcome back — sign in to your collection.' : 'Create an account to start your collection.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </label>

          {error && <p className="text-sm text-terracotta-dark">{error}</p>}
          {info && <p className="text-sm text-teal-dark">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full bg-terracotta px-4 py-2.5 text-sm font-semibold text-cream shadow-sm transition-transform active:scale-95 hover:bg-terracotta-dark disabled:opacity-60"
          >
            {submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError(null)
            setInfo(null)
          }}
          className="mt-4 w-full text-center text-sm text-teal hover:underline"
        >
          {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
