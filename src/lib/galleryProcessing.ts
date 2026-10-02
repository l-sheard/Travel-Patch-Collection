import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabaseClient'
import { removeBackgroundViaCloudflare } from './cloudflareBackgroundRemoval'
import { analyzePatchPhoto } from './imageMatch'
import { galleryPhotoPath, thumbPhotoPath } from './storagePaths'
import { removeStorageObjects, type StorageTarget } from './storageLifecycle'
import { imageExtensionFor, makeThumbnail } from './imageProcessing'

type RunArgs = {
  photoId: string
  patchId: string
  userId: string
  storagePathOriginal: string
  /** The gallery object this photo's row already points at, if any. */
  previousGalleryPath: string | null
  /** The thumbnail object this photo's row already points at, if any. */
  previousThumbPath: string | null
  queryClient: QueryClient
}

function invalidate(queryClient: QueryClient, patchId: string) {
  queryClient.invalidateQueries({ queryKey: ['patch-photos', patchId] })
  queryClient.invalidateQueries({ queryKey: ['patches'] })
}

async function runGalleryRemoval({
  photoId,
  patchId,
  userId,
  storagePathOriginal,
  previousGalleryPath,
  previousThumbPath,
  queryClient,
}: RunArgs) {
  try {
    await supabase.from('patch_photos').update({ gallery_status: 'processing' }).eq('id', photoId)
    invalidate(queryClient, patchId)

    const resultBlob = await removeBackgroundViaCloudflare(storagePathOriginal)
    const galleryPath = galleryPhotoPath(userId, patchId, photoId)

    const { error: uploadError } = await supabase.storage
      .from('patch-gallery')
      .upload(galleryPath, resultBlob, { contentType: 'image/png', upsert: true })
    if (uploadError) throw uploadError

    // The path is derived from the photo id, so re-running this overwrites the
    // object the row already references rather than creating a new one. Only
    // an object this run introduced may be cleaned up below — deleting the
    // pre-existing one would leave the row pointing at nothing.
    const isNewObject = galleryPath !== previousGalleryPath

    // Small square version for the dashboard cards. A failure here must not
    // fail the gallery image, so the row keeps whatever thumbnail it already
    // had (usually none) and the dashboard falls back to the gallery image.
    // The extension follows what the browser actually encoded, since canvas
    // quietly produces PNG where it can't encode WebP.
    let thumbPath = previousThumbPath
    try {
      const thumbBlob = await makeThumbnail(resultBlob)
      const candidate = thumbPhotoPath(userId, patchId, photoId, imageExtensionFor(thumbBlob))
      const { error: thumbError } = await supabase.storage
        .from('patch-gallery')
        .upload(candidate, thumbBlob, { contentType: thumbBlob.type, upsert: true })
      if (thumbError) throw thumbError
      thumbPath = candidate
    } catch (err) {
      console.error('Thumbnail generation failed for photo', photoId, err)
    }

    const isNewThumb = thumbPath !== null && thumbPath !== previousThumbPath

    // Compute the scan-match signature from this same cropped, background-free
    // image (not the raw upload) so matching compares just the patch, not
    // whatever surface/hand/lighting it happened to be photographed against.
    let embedding: number[] | null = null
    let phash: string | null = null
    try {
      const analysis = await analyzePatchPhoto(resultBlob)
      embedding = analysis.embedding
      phash = analysis.phash.toString()
    } catch (err) {
      console.error('Failed to compute match signature for photo', photoId, err)
    }

    const { data: updated, error: updateError } = await supabase
      .from('patch_photos')
      .update({
        storage_path_gallery: galleryPath,
        storage_path_thumb: thumbPath,
        gallery_status: 'done',
        embedding,
        phash,
      })
      .eq('id', photoId)
      .select('id')
    if (updateError) {
      const orphans: StorageTarget[] = []
      if (isNewObject) orphans.push({ bucket: 'patch-gallery', path: galleryPath })
      if (isNewThumb) orphans.push({ bucket: 'patch-gallery', path: thumbPath! })
      await removeStorageObjects(orphans)
      throw updateError
    }

    // No row matched: the photo (or its whole patch) was deleted while this was
    // running, so nothing references what we just uploaded, whether or not this
    // run introduced it.
    if (updated?.length === 0) {
      const orphans: StorageTarget[] = [{ bucket: 'patch-gallery', path: galleryPath }]
      if (thumbPath) orphans.push({ bucket: 'patch-gallery', path: thumbPath })
      await removeStorageObjects(orphans)
      return
    }

    // The thumbnail extension depends on what the browser could encode, so a
    // reprocess on a different browser can land on a different path. The row
    // now points at the new one, leaving the old object unreferenced.
    if (isNewThumb && previousThumbPath) {
      await removeStorageObjects([{ bucket: 'patch-gallery', path: previousThumbPath }])
    }
  } catch (err) {
    console.error('Background removal failed for photo', photoId, err)
    await supabase.from('patch_photos').update({ gallery_status: 'failed' }).eq('id', photoId)
  } finally {
    invalidate(queryClient, patchId)
  }
}

/** Fire-and-forget: runs background removal on a freshly uploaded photo. */
export function processGalleryImage(args: {
  photoId: string
  patchId: string
  userId: string
  storagePathOriginal: string
  queryClient: QueryClient
}) {
  return runGalleryRemoval({ ...args, previousGalleryPath: null, previousThumbPath: null })
}

/** Re-runs background removal against the already-uploaded original. */
export async function reprocessGalleryImage(args: RunArgs) {
  return runGalleryRemoval(args)
}
