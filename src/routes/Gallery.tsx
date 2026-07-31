import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GalleryIcon, PlusIcon, SearchIcon } from '../components/layout/icons'
import ErrorState from '../components/ErrorState'
import PatchCard from '../components/PatchCard'
import { usePatches } from '../hooks/usePatches'
import { CONTINENTS, getContinent, type Continent } from '../lib/continents'

export default function Gallery() {
  const { data: patches, isLoading, isError } = usePatches()
  const [search, setSearch] = useState('')
  const [continent, setContinent] = useState<Continent | 'All'>('All')

  const presentContinents = useMemo(() => {
    const set = new Set<Continent>()
    for (const patch of patches ?? []) {
      const c = getContinent(patch.country)
      if (c) set.add(c)
    }
    return CONTINENTS.filter((c) => set.has(c))
  }, [patches])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (patches ?? []).filter((patch) => {
      if (continent !== 'All' && getContinent(patch.country) !== continent) return false
      if (!query) return true
      const haystack = [patch.location_name, patch.country, patch.description, ...patch.companions]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [patches, search, continent])

  const hasPatches = (patches?.length ?? 0) > 0
  const hasFilters = search.trim() !== '' || continent !== 'All'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-dark">Patch gallery</h1>
        <p className="mt-1 text-sm text-ink/60">
          {isLoading
            ? 'Loading…'
            : hasFilters
              ? `${filtered.length} of ${patches?.length ?? 0} patches`
              : `${patches?.length ?? 0} ${patches?.length === 1 ? 'patch' : 'patches'} in your collection`}
        </p>
      </div>

      {isError && <ErrorState />}

      {!isLoading && !isError && hasPatches && (
        <div className="flex flex-col gap-3">
          <label className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by location, country, companions, or notes…"
              className="w-full rounded-full border border-ink/15 bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          </label>

          {presentContinents.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(['All', ...presentContinents] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setContinent(c)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    continent === c
                      ? 'bg-teal text-cream'
                      : 'border border-ink/15 bg-white text-ink/60 hover:border-teal/40 hover:text-teal-dark'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

      {hasPatches && filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-ink/50">
          No patches match your search.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((patch) => (
            <PatchCard key={patch.id} patch={patch} />
          ))}
        </div>
      )}
    </div>
  )
}
