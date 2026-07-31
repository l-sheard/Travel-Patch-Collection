import { SettingsIcon } from '../components/layout/icons'
import { useAuth } from '../context/AuthProvider'

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
        <p className="mb-3 text-sm text-ink/60">
          Storage usage and gallery-image reprocessing tools will live here in a later phase.
        </p>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-terracotta px-4 py-2 text-sm font-semibold text-terracotta-dark transition-transform active:scale-95 hover:bg-terracotta/10"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
