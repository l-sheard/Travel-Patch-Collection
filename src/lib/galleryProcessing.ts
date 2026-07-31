import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabaseClient'
import { removePatchBackground } from './backgroundRemoval'

type ProcessGalleryImageArgs = {
  photoId: string
  patchId: string
  userId: string
  originalFile: File
  queryClient: QueryClient
}

function invalidate(queryClient: QueryClient, patchId: string) {
  queryClient.invalidateQueries({ queryKey: ['patch-photos', patchId] })
  queryClient.invalidateQueries({ queryKey: ['patches'] })
}

/** Fire-and-forget: runs client-side background removal and uploads the result. */
export async function processGalleryImage({
  photoId,
  patchId,
  userId,
  originalFile,
  queryClient,
}: ProcessGalleryImageArgs) {
  try {
    await supabase.from('patch_photos').update({ gallery_status: 'processing' }).eq('id', photoId)
    invalidate(queryClient, patchId)

    const resultBlob = await removePatchBackground(originalFile)
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
