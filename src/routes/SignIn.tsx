import { useState, type FormEvent } from 'react'
import { StampIcon } from '../components/layout/icons'
import { useAuth } from '../context/AuthProvider'
import TurnstileWidget from '../components/TurnstileWidget'
import { isCaptchaEnabled } from '../lib/captcha'

type Mode = 'sign-in' | 'sign-up' | 'forgot'

export default function SignIn() {
  const { signInWithPassword, signUpWithPassword, sendPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (isCaptchaEnabled && !captchaToken) {
      setError('Please complete the verification check.')
      return
    }

    setSubmitting(true)

    if (mode === 'sign-in') {
      const { error } = await signInWithPassword(email, password, captchaToken ?? undefined)
      if (error) setError(error)
    } else if (mode === 'sign-up') {
      const { error, needsEmailConfirmation } = await signUpWithPassword(email, password, captchaToken ?? undefined)
      if (error) {
        setError(error)
      } else if (needsEmailConfirmation) {
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('sign-in')
      }
    } else {
      const { error } = await sendPasswordReset(email, captchaToken ?? undefined)
      if (error) {
        setError(error)
      } else {
        setInfo('If an account exists for that email, a reset link is on its way.')
      }
    }

    setSubmitting(false)
    setCaptchaToken(null)
    setTurnstileKey((k) => k + 1)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-3xl border-2 border-dashed border-teal/30 bg-white/60 p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 text-teal">
            <StampIcon className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-teal-dark">My Travel Patches</h1>
          <p className="mt-1 text-sm text-ink/60">
            {mode === 'sign-in' && 'Welcome back — sign in to your collection.'}
            {mode === 'sign-up' && 'Create an account to start your collection.'}
            {mode === 'forgot' && "Enter your email and we'll send a reset link."}
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

          {mode !== 'forgot' && (
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
          )}

          {mode === 'sign-in' && (
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="self-end text-xs text-teal hover:underline"
            >
              Forgot password?
            </button>
          )}

          {isCaptchaEnabled && <TurnstileWidget key={turnstileKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />}

          {error && <p className="text-sm text-terracotta-dark">{error}</p>}
          {info && <p className="text-sm text-teal-dark">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full bg-terracotta px-4 py-2.5 text-sm font-semibold text-cream shadow-sm transition-transform active:scale-95 hover:bg-terracotta-dark disabled:opacity-60"
          >
            {submitting
              ? 'Please wait…'
              : mode === 'sign-in'
                ? 'Sign in'
                : mode === 'sign-up'
                  ? 'Create account'
                  : 'Send reset link'}
          </button>
        </form>

        {mode === 'forgot' ? (
          <button
            type="button"
            onClick={() => switchMode('sign-in')}
            className="mt-4 w-full text-center text-sm text-teal hover:underline"
          >
            Back to sign in
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            className="mt-4 w-full text-center text-sm text-teal hover:underline"
          >
            {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        )}
      </div>
    </div>
  )
}
