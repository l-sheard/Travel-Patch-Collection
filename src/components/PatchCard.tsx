import { Link } from 'react-router-dom'
import type { PatchWithPhotos } from '../types/patch'
import { usePhotoUrl } from '../hooks/usePhotoUrl'
import LoadingStamp from './LoadingStamp'

type Props = {
  patch: PatchWithPhotos
}

export default function PatchCard({ patch }: Props) {
  const cover = patch.patch_photos.find((p) => p.is_cover) ?? patch.patch_photos[0]
  const bucket = cover?.storage_path_gallery ? 'patch-gallery' : 'patch-originals'
  const path = cover?.storage_path_gallery ?? cover?.storage_path_original
  const { data: url } = usePhotoUrl(bucket, path)
  const isProcessing = cover?.gallery_status === 'pending' || cover?.gallery_status === 'processing'

  return (
    <Link
      to={`/patches/${patch.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-sm transition-transform hover:-translate-y-0.5"
    >
      <div className="relative flex aspect-square items-center justify-center bg-cream-dark/60 p-3">
        {cover && !url ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-ink/5" />
        ) : url ? (
          <img src={url} alt={patch.location_name} className="h-full w-full object-contain drop-shadow" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink/30">No photo</div>
        )}
        {isProcessing && <LoadingStamp className="absolute right-2 top-2 h-6 w-6" />}
      </div>
      <div className="border-t border-dashed border-ink/15 px-3 py-2.5">
        <p className="font-display text-base font-semibold text-teal-dark">{patch.location_name}</p>
        <p className="text-xs text-ink/50">
          {patch.trip_start_date
            ? new Date(patch.trip_start_date).toLocaleDateString(undefined, {
                month: 'short',
                year: 'numeric',
              })
            : 'No trip date'}
        </p>
      </div>
    </Link>
  )
}
