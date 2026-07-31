import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabaseClient'
import { removePatchBackground } from './backgroundRemoval'

type RunArgs = {
  photoId: string
  patchId: string
  userId: string
  sourceBlob: File | Blob
  queryClient: QueryClient
}

function invalidate(queryClient: QueryClient, patchId: string) {
  queryClient.invalidateQueries({ queryKey: ['patch-photos', patchId] })
  queryClient.invalidateQueries({ queryKey: ['patches'] })
}

async function runGalleryRemoval({ photoId, patchId, userId, sourceBlob, queryClient }: RunArgs) {
  try {
    await supabase.from('patch_photos').update({ gallery_status: 'processing' }).eq('id', photoId)
    invalidate(queryClient, patchId)

    const resultBlob = await removePatchBackground(sourceBlob)
    const galleryPath = `${userId}/${patchId}/${photoId}-gallery.png`

    const { error: uploadError } = await supabase.storage
      .from('patch-gallery')
      .upload(galleryPath, resultBlob, { contentType: 'image/png', upsert: true })
    if (uploadError) throw uploadError

    const { error: updateError } = await supabase
      .from('patch_photos')
      .update({ storage_path_gallery: galleryPath, gallery_status: 'done' })
      .eq('id', photoId)
    if (updateError) throw updateError
  } catch (err) {
    console.error('Background removal failed for photo', photoId, err)
    await supabase.from('patch_photos').update({ gallery_status: 'failed' }).eq('id', photoId)
  } finally {
    invalidate(queryClient, patchId)
  }
}

/** Fire-and-forget: runs client-side background removal on a freshly uploaded photo. */
export function processGalleryImage(args: {
  photoId: string
  patchId: string
  userId: string
  originalFile: File
  queryClient: QueryClient
}) {
  return runGalleryRemoval({ ...args, sourceBlob: args.originalFile })
}

/** Re-runs background removal against the already-uploaded original (no re-upload needed). */
export async function reprocessGalleryImage(args: {
  photoId: string
  patchId: string
  userId: string
  storagePathOriginal: string
  queryClient: QueryClient
}) {
  const { data: blob, error } = await supabase.storage.from('patch-originals').download(args.storagePathOriginal)
  if (error || !blob) {
    console.error('Failed to download original photo for reprocessing', error)
    return
  }
  return runGalleryRemoval({ ...args, sourceBlob: blob })
}
