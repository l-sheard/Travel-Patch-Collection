import type { QueryClient } from '@tanstack/react-query'
import { supabase } from './supabaseClient'
import { analyzePatchPhoto } from './imageMatch'

type IndexArgs = {
  photoId: string
  patchId: string
  file: File
  queryClient: QueryClient
}

/** Fire-and-forget: computes and stores the embedding/phash used by scan-matching. */
export async function indexPatchPhotoForMatching({ photoId, patchId, file, queryClient }: IndexArgs) {
  try {
    const { embedding, phash } = await analyzePatchPhoto(file)
    const { error } = await supabase
      .from('patch_photos')
      .update({ embedding, phash: phash.toString() })
      .eq('id', photoId)
    if (error) throw error
  } catch (err) {
    console.error('Failed to index photo for scan-matching', photoId, err)
  } finally {
    queryClient.invalidateQueries({ queryKey: ['patch-photos', patchId] })
    queryClient.invalidateQueries({ queryKey: ['patches'] })
  }
}
