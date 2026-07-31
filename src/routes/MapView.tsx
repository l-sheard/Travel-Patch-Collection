import { Link } from 'react-router-dom'
import { MapIcon } from '../components/layout/icons'
import PatchMap from '../components/LazyPatchMap'
import { usePatches } from '../hooks/usePatches'

export default function MapView() {
  const { data: patches, isLoading } = usePatches()
  const pinned = (patches ?? []).filter((p) => p.lat != null && p.lng != null)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-dark">Your travels</h1>
        <p className="mt-1 text-sm text-ink/60">
          {isLoading ? 'Loading…' : `${pinned.length} of ${patches?.length ?? 0} patches plotted`}
        </p>
      </div>

      {!isLoading && pinned.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-teal/30 bg-white/40 px-6 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal/10 text-teal">
            <MapIcon className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-teal-dark">No patches on the map yet</h2>
          <p className="mb-4 max-w-sm text-sm text-ink/60">
            Add a patch and pick its location from the search suggestions to see it plotted here.
          </p>
          <Link
            to="/patches/new"
            className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream shadow-sm hover:bg-terracotta-dark"
          >
            Add a patch
          </Link>
        </div>
      ) : (
        <PatchMap patches={patches ?? []} />
      )}
    </div>
  )
}
