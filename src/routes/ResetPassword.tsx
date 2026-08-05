import { useState, type FormEvent } from 'react'
import { StampIcon } from '../components/layout/icons'
import { useAuth } from '../context/AuthProvider'

export default function ResetPassword() {
  const { updatePassword, cancelPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setSubmitting(true)
    const { error } = await updatePassword(password)
    if (error) setError(error)
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-3xl border-2 border-dashed border-teal/30 bg-white/60 p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 text-teal">
            <StampIcon className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-teal-dark">Set a new password</h1>
          <p className="mt-1 text-sm text-ink/60">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            New password
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Confirm new password
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </label>

          {error && <p className="text-sm text-terracotta-dark">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full bg-terracotta px-4 py-2.5 text-sm font-semibold text-cream shadow-sm transition-transform active:scale-95 hover:bg-terracotta-dark disabled:opacity-60"
          >
            {submitting ? 'Please wait…' : 'Update password'}
          </button>
        </form>

        <button
          type="button"
          onClick={cancelPasswordRecovery}
          className="mt-4 w-full text-center text-sm text-teal hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
