// Every storage object lives under `${userId}/...` because that is what the
// storage RLS policies check (see supabase/schema.sql). Paths are derived
// purely from ids, never from a timestamp or a fresh random value, so retrying
// an upload reuses the same object instead of leaving a duplicate behind.

export type StorageBucket = 'patch-originals' | 'patch-gallery' | 'patch-dishes'

/** Lowercased extension from a File's name, or `fallback` when there isn't a
 * usable one — a Blob (no name), a name with no dot, or something that isn't a
 * plausible extension. */
export function fileExtension(file: File | Blob, fallback = 'jpg'): string {
  if (!(file instanceof File)) return fallback
  const name = file.name.toLowerCase()
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return fallback
  const ext = name.slice(dot + 1)
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : fallback
}

export function originalPhotoPath(userId: string, patchId: string, photoId: string, ext: string): string {
  return `${userId}/${patchId}/${photoId}.${ext}`
}

export function galleryPhotoPath(userId: string, patchId: string, photoId: string): string {
  return `${userId}/${patchId}/${photoId}-gallery.png`
}

/** Small square version of the gallery image, for dashboard cards. Lives in
 * the same bucket and prefix as the gallery image so it is covered by the same
 * storage policies and the same cleanup paths. The extension comes from what
 * the browser actually encoded, not from what was requested. */
export function thumbPhotoPath(userId: string, patchId: string, photoId: string, ext: string): string {
  return `${userId}/${patchId}/${photoId}-thumb.${ext}`
}

export function dishPhotoPath(userId: string, patchId: string, dishId: string, ext: string): string {
  return `${userId}/${patchId}/${dishId}.${ext}`
}

/** Scratch upload for a scan that is never persisted — no row ever references
 * it, so it is always safe to delete. */
export function scanTempPath(userId: string, scanId: string, ext: string): string {
  return `${userId}/_scan-temp/${scanId}.${ext}`
}
