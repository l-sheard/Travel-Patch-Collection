import { Link } from 'react-router-dom'
import { GalleryIcon, PlusIcon } from '../components/layout/icons'
import ErrorState from '../components/ErrorState'
import PatchCard from '../components/PatchCard'
import { usePatches } from '../hooks/usePatches'

export default function Gallery() {
  const { data: patches, isLoading, isError } = usePatches()
  const hasPatches = (patches?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-dark">Patch gallery</h1>
        <p className="mt-1 text-sm text-ink/60">
          {isLoading ? 'Loading…' : `${patches?.length ?? 0} ${patches?.length === 1 ? 'patch' : 'patches'} in your collection`}
        </p>
      </div>

      {isError && <ErrorState />}

      {!isLoading && !isError && !hasPatches && (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-teal/30 bg-white/40 px-6 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal/10 text-teal">
            <GalleryIcon className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-teal-dark">Your gallery is empty</h2>
          <p className="mb-4 max-w-sm text-sm text-ink/60">
            Add a patch with a photo and it'll show up here as a background-removed sticker.
          </p>
          <Link
            to="/patches/new"
            className="flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream shadow-sm hover:bg-terracotta-dark"
          >
            <PlusIcon className="h-4 w-4" />
            Add your first patch
          </Link>
        </div>
      )}

      {hasPatches && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {patches!.map((patch) => (
            <PatchCard key={patch.id} patch={patch} />
          ))}
        </div>
      )}
    </div>
  )
}
