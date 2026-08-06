import { useState, type FormEvent } from 'react'
import { SettingsIcon } from '../components/layout/icons'
import { useAuth } from '../context/AuthProvider'
import { deleteAccount } from '../lib/deleteAccount'

const inputClasses =
  'rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20'

function ChangeEmailForm() {
  const { user, updateEmail } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const { error } = await updateEmail(email)
    if (error) setError(error)
    else setInfo('Check your new email address to confirm the change.')

    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
        />
      </label>

      {error && <p className="text-sm text-terracotta-dark">{error}</p>}
      {info && <p className="text-sm text-teal-dark">{info}</p>}

      <button
        type="submit"
        disabled={submitting || email === user?.email}
        className="self-start rounded-full bg-teal px-4 py-2 text-sm font-semibold text-cream shadow-sm transition-transform active:scale-95 hover:bg-teal-dark disabled:opacity-50"
      >
        {submitting ? 'Updating…' : 'Update email'}
      </button>
    </form>
  )
}

function ChangePasswordForm() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setSubmitting(true)
    const { error } = await updatePassword(password)
    if (error) {
      setError(error)
    } else {
      setInfo('Password updated.')
      setPassword('')
      setConfirmPassword('')
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
        New password
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClasses}
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
          className={inputClasses}
        />
      </label>

      {error && <p className="text-sm text-terracotta-dark">{error}</p>}
      {info && <p className="text-sm text-teal-dark">{info}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-teal px-4 py-2 text-sm font-semibold text-cream shadow-sm transition-transform active:scale-95 hover:bg-teal-dark disabled:opacity-50"
      >
        {submitting ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}

function DeleteAccountSection() {
  const { user } = useAuth()
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const canConfirm = confirmText === user?.email

  async function handleDelete() {
    setError(null)
    setDeleting(true)
    const { error } = await deleteAccount()
    if (error) {
      setError(error)
      setDeleting(false)
    }
    // On success deleteAccount() already signs out — the app redirects to
    // the sign-in screen on its own once the session clears.
  }

  return (
    <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5">
      <h2 className="mb-1 font-display text-lg font-semibold text-terracotta-dark">Danger zone</h2>
      <p className="mb-3 text-sm text-ink/60">
        Permanently delete your account and everything in it — every patch, trip, and photo. This cannot be undone.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta-dark transition-transform active:scale-95 hover:bg-terracotta/10"
        >
          Delete account
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            Type <span className="font-semibold">{user?.email}</span> to confirm
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="rounded-xl border border-terracotta/30 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20"
            />
          </label>

          {error && <p className="text-sm text-terracotta-dark">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canConfirm || deleting}
              onClick={handleDelete}
              className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream shadow-sm transition-transform active:scale-95 hover:bg-terracotta-dark disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Permanently delete my account'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                setConfirmText('')
                setError(null)
              }}
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-ink/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-teal-dark">Settings</h1>
          <p className="text-sm text-ink/60">{user?.email}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/60 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-teal-dark">Email</h2>
        <ChangeEmailForm />
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/60 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-teal-dark">Password</h2>
        <ChangePasswordForm />
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/60 p-5">
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta-dark transition-transform active:scale-95 hover:bg-terracotta/10"
        >
          Sign out
        </button>
      </div>

      <DeleteAccountSection />
    </div>
  )
}
