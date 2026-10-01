import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabaseClient'
import { removePatchBackground } from './backgroundRemoval'
import { isCloudflareBackgroundRemovalEnabled, removeBackgroundViaCloudflare } from './cloudflareBackgroundRemoval'
import { analyzePatchPhoto } from './imageMatch'
import { galleryPhotoPath } from './storagePaths'
import { removeStorageObjects } from './storageLifecycle'

type RunArgs = {
  photoId: string
  patchId: string
  userId: string
  storagePathOriginal: string
  /** The gallery object this photo's row already points at, if any. */
  previousGalleryPath: string | null
  getFallbackBlob: () => Promise<Blob>
  queryClient: QueryClient
}

function invalidate(queryClient: QueryClient, patchId: string) {
  queryClient.invalidateQueries({ queryKey: ['patch-photos', patchId] })
  queryClient.invalidateQueries({ queryKey: ['patches'] })
}

/** Cloudflare Worker first (fast, server-side) if configured; on-device
 * model otherwise or if the Worker call fails for any reason. */
async function removeBackground(storagePathOriginal: string, getFallbackBlob: () => Promise<Blob>): Promise<Blob> {
  if (isCloudflareBackgroundRemovalEnabled) {
    try {
      return await removeBackgroundViaCloudflare(storagePathOriginal)
    } catch (err) {
      console.error('Cloudflare background removal failed, falling back to on-device', err)
    }
  }
  return removePatchBackground(await getFallbackBlob())
}

async function runGalleryRemoval({
  photoId,
  patchId,
  userId,
  storagePathOriginal,
  previousGalleryPath,
  getFallbackBlob,
  queryClient,
}: RunArgs) {
  try {
    await supabase.from('patch_photos').update({ gallery_status: 'processing' }).eq('id', photoId)
    invalidate(queryClient, patchId)

    const resultBlob = await removeBackground(storagePathOriginal, getFallbackBlob)
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
      .update({ storage_path_gallery: galleryPath, gallery_status: 'done', embedding, phash })
      .eq('id', photoId)
      .select('id')
    if (updateError) {
      if (isNewObject) await removeStorageObjects([{ bucket: 'patch-gallery', path: galleryPath }])
      throw updateError
    }

    // No row matched: the photo (or its whole patch) was deleted while this was
    // running, so nothing references what we just uploaded, whether or not this
    // run introduced it.
    if (updated?.length === 0) {
      await removeStorageObjects([{ bucket: 'patch-gallery', path: galleryPath }])
    }
  } catch (err) {
    console.error('Background removal failed for photo', photoId, err)
    await supabase.from('patch_photos').update({ gallery_status: 'failed' }).eq('id', photoId)
  } finally {
    invalidate(queryClient, patchId)
  }
}

/** Fire-and-forget: runs background removal (Cloudflare Worker if configured,
 * else on-device) on a freshly uploaded photo. */
export function processGalleryImage(args: {
  photoId: string
  patchId: string
  userId: string
  storagePathOriginal: string
  originalFile: File
  queryClient: QueryClient
}) {
  return runGalleryRemoval({
    ...args,
    previousGalleryPath: null,
    getFallbackBlob: async () => args.originalFile,
  })
}

/** Re-runs background removal against the already-uploaded original (no re-upload needed). */
export async function reprocessGalleryImage(args: {
  photoId: string
  patchId: string
  userId: string
  storagePathOriginal: string
  previousGalleryPath: string | null
  queryClient: QueryClient
}) {
  return runGalleryRemoval({
    ...args,
    getFallbackBlob: async () => {
      const { data: blob, error } = await supabase.storage.from('patch-originals').download(args.storagePathOriginal)
      if (error || !blob) throw error ?? new Error('Failed to download original photo for reprocessing')
      return blob
    },
  })
}
