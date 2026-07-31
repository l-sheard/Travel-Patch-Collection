import { Link } from 'react-router-dom'
import { HomeIcon, PlusIcon } from '../components/layout/icons'
import ErrorState from '../components/ErrorState'
import PatchCard from '../components/PatchCard'
import TripCard from '../components/TripCard'
import { usePatches } from '../hooks/usePatches'
import { useRecentTrips } from '../hooks/useTrips'

export default function Dashboard() {
  const { data: patches, isLoading, isError } = usePatches()
  const { data: trips } = useRecentTrips()

  const countryCount = new Set((patches ?? []).map((p) => p.country).filter(Boolean)).size
  const hasPatches = (patches?.length ?? 0) > 0
  const hasTrips = (trips?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-dark">Your collection</h1>
        <p className="mt-1 text-sm text-ink/60">
          {isLoading
            ? 'Loading…'
            : `${patches?.length ?? 0} ${patches?.length === 1 ? 'patch' : 'patches'} from ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`}
        </p>
      </div>

      {isError && <ErrorState />}

      {!isLoading && !isError && !hasPatches && (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-teal/30 bg-white/40 px-6 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal/10 text-teal">
            <HomeIcon className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-teal-dark">No patches yet</h2>
          <p className="mb-4 max-w-sm text-sm text-ink/60">Add your first patch to start building your collection.</p>
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
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-teal-dark">Recent finds</h2>
            <Link to="/gallery" className="text-sm text-teal hover:underline">
              View gallery
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {patches!.slice(0, 8).map((patch) => (
              <PatchCard key={patch.id} patch={patch} />
            ))}
          </div>
        </div>
      )}

      {hasTrips && (
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold text-teal-dark">Recent trips</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {trips!.slice(0, 8).map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
