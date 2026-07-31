import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { StampIcon } from '../components/layout/icons'
import LoadingStamp from '../components/LoadingStamp'
import PatchMap from '../components/LazyPatchMap'
import PlaceholderPage from '../components/PlaceholderPage'
import { useAuth } from '../context/AuthProvider'
import { useDeletePatch, usePatch } from '../hooks/usePatches'
import { useDeletePatchPhoto, usePatchPhotos } from '../hooks/usePatchPhotos'
import { useDeletePatchDish, usePatchDishes } from '../hooks/usePatchDishes'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import { useTrip } from '../hooks/useTrips'
import { reprocessGalleryImage } from '../lib/galleryProcessing'
import StarRating from '../components/StarRating'
import type { PatchDish, PatchPhoto } from '../types/patch'

function TextSection({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="mb-5">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">{label}</p>
      <p className="whitespace-pre-wrap rounded-xl border border-dashed border-ink/15 p-3 text-sm text-ink/80">
        {value}
      </p>
    </div>
  )
}

function DeletePhotoButton({ photo, className }: { photo: PatchPhoto; className?: string }) {
  const deletePhoto = useDeletePatchPhoto()

  function handleClick() {
    if (!confirm(photo.is_cover ? 'Remove this patch photo? It also stops being used for the gallery and scan matching.' : 'Remove this photo?')) return
    deletePhoto.mutate(photo)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Remove photo"
      className={`flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-sm text-cream hover:bg-terracotta-dark ${className ?? ''}`}
    >
      ×
    </button>
  )
}

function PhotoTile({ photo }: { photo: PatchPhoto }) {
  const { data: url } = usePhotoUrl('patch-originals', photo.storage_path_original)
  return (
    <div className="relative aspect-square">
      {url ? (
        <img src={url} alt="" className="h-full w-full rounded-xl object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-xl bg-ink/5" />
      )}
      <DeletePhotoButton photo={photo} className="absolute right-1.5 top-1.5" />
    </div>
  )
}

function CoverPhoto({ photo, patchId }: { photo: PatchPhoto; patchId: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const bucket = photo.storage_path_gallery ? 'patch-gallery' : 'patch-originals'
  const path = photo.storage_path_gallery ?? photo.storage_path_original
  const { data: url } = usePhotoUrl(bucket, path)
  const isProcessing = photo.gallery_status === 'pending' || photo.gallery_status === 'processing'

  function handleReprocess() {
    if (!user) return
    reprocessGalleryImage({
      photoId: photo.id,
      patchId,
      userId: user.id,
      storagePathOriginal: photo.storage_path_original,
      queryClient,
    })
  }

  return (
    <div className="relative mb-5 flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-cream-dark/60 p-1">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain drop-shadow" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-xl bg-ink/5" />
      )}
      <DeletePhotoButton photo={photo} className="absolute left-3 top-3" />
      {isProcessing && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-teal px-2.5 py-1 text-xs font-medium text-cream shadow-sm">
          <LoadingStamp className="h-4 w-4" />
          Removing background…
        </div>
      )}
      {!isProcessing && photo.storage_path_gallery && (
        <button
          type="button"
          onClick={handleReprocess}
          className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-ink/70 shadow-sm hover:bg-white"
        >
          Reprocess background
        </button>
      )}
    </div>
  )
}

function DishTile({ dish }: { dish: PatchDish }) {
  const { data: url } = usePhotoUrl('patch-dishes', dish.storage_path)
  const deleteDish = useDeletePatchDish()

  function handleDelete() {
    if (!confirm('Remove this dish?')) return
    deleteDish.mutate(dish)
  }

  if (!dish.storage_path) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-mustard/20 py-1.5 pl-3 pr-1.5 text-xs font-medium text-ink/80">
        {dish.name || 'Untitled dish'}
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Remove dish"
          className="flex h-4 w-4 items-center justify-center text-ink/40 hover:text-terracotta-dark"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-24 flex-col gap-1">
      <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-ink/10">
        {url ? (
          <img src={url} alt={dish.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full animate-pulse rounded-xl bg-ink/5" />
        )}
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Remove dish"
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/60 text-xs text-cream hover:bg-terracotta-dark"
        >
          ×
        </button>
      </div>
      {dish.name && <p className="truncate text-xs text-ink/70">{dish.name}</p>}
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatPrice(value: number) {
  return `£${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
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
  const { data: patch, isLoading, isError } = usePatch(id)
  const { data: photos } = usePatchPhotos(id)
  const { data: dishes } = usePatchDishes(id)
  const { data: trip } = useTrip(patch?.trip_id)
  const deletePatch = useDeletePatch()

  if (isLoading) {
    return <PlaceholderPage icon={StampIcon} title="Loading…" description="Fetching this patch's details." />
  }

  if (isError) {
    return (
      <PlaceholderPage
        icon={StampIcon}
        title="Couldn't load this patch"
        description="Something went wrong fetching it — try refreshing the page."
      />
    )
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
            {patch.rating != null && (
              <div className="mt-1">
                <StarRating value={patch.rating} readOnly size="text-base" />
              </div>
            )}
            {trip && (
              <Link
                to={`/trips/${trip.id}`}
                className="mt-1 inline-block text-xs font-medium text-terracotta-dark hover:underline"
              >
                Part of trip: {trip.name}
              </Link>
            )}
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
              {cover && <CoverPhoto photo={cover} patchId={patch.id} />}
              {otherPhotos.length > 0 && (
                <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {otherPhotos.map((photo) => (
                    <PhotoTile key={photo.id} photo={photo} />
                  ))}
                </div>
              )}
            </>
          )
        })()}

        <div className="mb-5 flex flex-wrap gap-3">
          {tripRange && <DateStamp label="Trip" value={tripRange} />}
          {patch.purchased_date && <DateStamp label="Purchased" value={formatDate(patch.purchased_date)!} />}
          {patch.price != null && <DateStamp label="Trip cost" value={formatPrice(patch.price)} />}
        </div>

        {patch.holiday_types.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">Type of holiday</p>
            <div className="flex flex-wrap gap-2">
              {patch.holiday_types.map((type) => (
                <span key={type} className="rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal-dark">
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

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

        {patch.accommodations.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">Where we stayed</p>
            <div className="flex flex-col gap-2">
              {patch.accommodations.map((acc, i) => (
                <div key={i} className="rounded-xl border border-ink/10 bg-white/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    {acc.url ? (
                      <a
                        href={acc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-teal hover:underline"
                      >
                        {acc.name}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-ink/80">{acc.name}</p>
                    )}
                    {acc.rating != null && <StarRating value={acc.rating} readOnly size="text-sm" />}
                  </div>
                  {(acc.nights != null || acc.people != null) && (
                    <p className="mt-0.5 text-xs text-ink/50">
                      {[
                        acc.nights != null ? `${acc.nights} night${acc.nights === 1 ? '' : 's'}` : null,
                        acc.people != null ? `${acc.people} ${acc.people === 1 ? 'person' : 'people'}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  {acc.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-ink/60">{acc.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {patch.restaurants.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">Good restaurants</p>
            <ul className="flex flex-col gap-1">
              {patch.restaurants.map((r, i) => (
                <li key={i} className="text-sm text-ink/80">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">
                      {r.name}
                    </a>
                  ) : (
                    r.name
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {dishes && dishes.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">Favorite dishes</p>
            <div className="flex flex-wrap items-start gap-3">
              {dishes.map((dish) => (
                <DishTile key={dish.id} dish={dish} />
              ))}
            </div>
          </div>
        )}

        <TextSection label="Review" value={patch.review} />
        <TextSection label="Itinerary" value={patch.itinerary} />
        <TextSection label="Highlights" value={patch.highlights} />
        <TextSection label="Notes" value={patch.description} />

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
