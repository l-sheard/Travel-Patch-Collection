import { Link } from 'react-router-dom'
import StarRating from './StarRating'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import type { PatchWithPhotos, Trip } from '../types/patch'

type Props = {
  trip: Trip & { patches: PatchWithPhotos[] }
}

export default function TripCard({ trip }: Props) {
  const firstPatch = trip.patches[0]
  const cover = firstPatch?.patch_photos.find((p) => p.is_cover) ?? firstPatch?.patch_photos[0]
  const bucket = cover?.storage_path_gallery ? 'patch-gallery' : 'patch-originals'
  const path = cover?.storage_path_gallery ?? cover?.storage_path_original
  const { data: url } = usePhotoUrl(bucket, path)

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-sm transition-transform hover:-translate-y-0.5"
    >
      <div className="flex aspect-square items-center justify-center bg-cream-dark/60 p-1">
        {cover && !url ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-ink/5" />
        ) : url ? (
          <img src={url} alt={trip.name} className="h-full w-full object-contain drop-shadow" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink/30">No photo</div>
        )}
      </div>
      <div className="border-t border-dashed border-ink/15 px-3 py-2.5">
        <p className="font-display text-base font-semibold text-teal-dark">{trip.name}</p>
        <p className="text-xs text-ink/50">
          {trip.patches.length} {trip.patches.length === 1 ? 'stop' : 'stops'}
        </p>
        {trip.rating != null && (
          <div className="mt-0.5">
            <StarRating value={trip.rating} readOnly size="text-xs" />
          </div>
        )}
      </div>
    </Link>
  )
}
