import { Link, useNavigate, useParams } from 'react-router-dom'
import { StampIcon } from '../components/layout/icons'
import LoadingStamp from '../components/LoadingStamp'
import PatchMap from '../components/LazyPatchMap'
import PlaceholderPage from '../components/PlaceholderPage'
import { useDeletePatch, usePatch } from '../hooks/usePatches'
import { usePatchPhotos } from '../hooks/usePatchPhotos'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import type { PatchPhoto } from '../types/patch'

function PhotoTile({ path }: { path: string }) {
  const { data: url } = usePhotoUrl('patch-originals', path)
  if (!url) return <div className="aspect-square animate-pulse rounded-xl bg-ink/5" />
  return <img src={url} alt="" className="aspect-square w-full rounded-xl object-cover" />
}

function CoverPhoto({ photo }: { photo: PatchPhoto }) {
  const bucket = photo.storage_path_gallery ? 'patch-gallery' : 'patch-originals'
  const path = photo.storage_path_gallery ?? photo.storage_path_original
  const { data: url } = usePhotoUrl(bucket, path)
  const isProcessing = photo.gallery_status === 'pending' || photo.gallery_status === 'processing'

  return (
    <div className="relative mb-5 flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-cream-dark/60 p-4">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain drop-shadow" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-xl bg-ink/5" />
      )}
      {isProcessing && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-teal px-2.5 py-1 text-xs font-medium text-cream shadow-sm">
          <LoadingStamp className="h-4 w-4" />
          Removing background…
        </div>
      )}
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function DateStamp({ label, value }: { label: string; value: string }) {
  return (
    <div className="-rotate-2 rounded-lg border-2 border-dashed border-terracotta/40 px-3 py-1.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-terracotta-dark">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}

export default function PatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: patch, isLoading } = usePatch(id)
  const { data: photos } = usePatchPhotos(id)
  const deletePatch = useDeletePatch()

  if (isLoading) {
    return <PlaceholderPage icon={StampIcon} title="Loading…" description="Fetching this patch's details." />
  }

  if (!patch) {
    return <PlaceholderPage icon={StampIcon} title="Patch not found" description="This patch may have been removed." />
  }

  async function handleDelete() {
    if (!patch) return
    if (!confirm(`Delete the ${patch.location_name} patch? This can't be undone.`)) return
    await deletePatch.mutateAsync(patch.id)
    navigate('/gallery')
  }

  const tripRange = [formatDate(patch.trip_start_date), formatDate(patch.trip_end_date)]
    .filter(Boolean)
    .join(' – ')

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-ink/10 bg-white/60 p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-teal-dark">{patch.location_name}</h1>
            {patch.country && <p className="text-sm text-ink/50">{patch.country}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              to={`/patches/${patch.id}/edit`}
              className="rounded-full border border-teal px-3 py-1.5 text-xs font-semibold text-teal-dark hover:bg-teal/10"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-full border border-terracotta px-3 py-1.5 text-xs font-semibold text-terracotta-dark hover:bg-terracotta/10"
            >
              Delete
            </button>
          </div>
        </div>

        {(() => {
          const cover = photos?.find((p) => p.is_cover)
          const otherPhotos = photos?.filter((p) => p.id !== cover?.id) ?? []
          return (
            <>
              {cover && <CoverPhoto photo={cover} />}
              {otherPhotos.length > 0 && (
                <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {otherPhotos.map((photo) => (
                    <PhotoTile key={photo.id} path={photo.storage_path_original} />
                  ))}
                </div>
              )}
            </>
          )
        })()}

        <div className="mb-5 flex flex-wrap gap-3">
          {tripRange && <DateStamp label="Trip" value={tripRange} />}
          {patch.purchased_date && <DateStamp label="Purchased" value={formatDate(patch.purchased_date)!} />}
        </div>

        {patch.companions.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">Travelled with</p>
            <div className="flex flex-wrap gap-2">
              {patch.companions.map((name) => (
                <span key={name} className="rounded-full bg-mustard/20 px-2.5 py-1 text-xs font-medium text-ink/80">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {patch.description && (
          <div className="mb-5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">Notes</p>
            <p className="whitespace-pre-wrap rounded-xl border border-dashed border-ink/15 p-3 text-sm text-ink/80">
              {patch.description}
            </p>
          </div>
        )}

        {patch.lat != null && patch.lng != null && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">Location</p>
            <PatchMap patches={[{ ...patch, patch_photos: photos ?? [] }]} className="h-48" />
          </div>
        )}
      </div>
    </div>
  )
}
