import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { PatchPhoto } from '../types/patch'
import { useAuth } from '../context/AuthProvider'
import { processGalleryImage } from '../lib/galleryProcessing'
import { fileExtension, originalPhotoPath } from '../lib/storagePaths'
import { removeStorageObjects, uploadThenRecord, type StorageTarget } from '../lib/storageLifecycle'

export function usePatchPhotos(patchId: string | undefined) {
  return useQuery({
    queryKey: ['patch-photos', patchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patch_photos')
        .select('*')
        .eq('patch_id', patchId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as PatchPhoto[]
    },
    enabled: !!patchId,
  })
}

/** Sets (or replaces) the photo of the physical patch — the gallery sticker
 * and scan-match reference. A patch has exactly one, and this is the only way
 * to change it; see the invariants in supabase/schema.sql. */
export function useReplacePatchCover() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ patchId, file }: { patchId: string; file: File }) => {
      if (!user) throw new Error('Not signed in')
      const photoId = crypto.randomUUID()
      const path = originalPhotoPath(user.id, patchId, photoId, fileExtension(file))

      // Upload first: the existing cover row and its file stay untouched until
      // the swap below commits, so a failed upload changes nothing.
      const replaced = await uploadThenRecord({
        bucket: 'patch-originals',
        path,
        file,
        record: async () => {
          const { data, error } = await supabase.rpc('replace_patch_cover', {
            p_patch_id: patchId,
            p_photo_id: photoId,
            p_storage_path_original: path,
          })
          if (error) throw error
          return (data ?? []) as StorageTarget[]
        },
      })

      // The swap committed, so the outgoing photo's objects are unreferenced.
      // Failing here leaves them orphaned, which is recoverable; rolling the
      // database back to a file we may have already deleted would not be.
      await removeStorageObjects(replaced)

      return { photoId, storagePathOriginal: path }
    },
    onSuccess: ({ photoId, storagePathOriginal }, { patchId }) => {
      queryClient.invalidateQueries({ queryKey: ['patch-photos', patchId] })
      queryClient.invalidateQueries({ queryKey: ['patches'] })

      if (!user) return
      processGalleryImage({
        photoId,
        patchId,
        userId: user.id,
        storagePathOriginal,
        queryClient,
      })
    },
  })
}

/** Adds an ordinary trip/holiday photo. Never a cover — `is_cover` is only
 * ever written by replace_patch_cover(), so no photo added here can be
 * promoted into the patch photo's role. */
export function useUploadTripPhoto() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ patchId, file }: { patchId: string; file: File }) => {
      if (!user) throw new Error('Not signed in')
      const photoId = crypto.randomUUID()
      const path = originalPhotoPath(user.id, patchId, photoId, fileExtension(file))

      return uploadThenRecord({
        bucket: 'patch-originals',
        path,
        file,
        record: async () => {
          const { data, error } = await supabase
            .from('patch_photos')
            .insert({
              id: photoId,
              patch_id: patchId,
              user_id: user.id,
              role: 'original',
              storage_path_original: path,
              is_cover: false,
            })
            .select()
            .single()
          if (error) throw error
          return data as PatchPhoto
        },
      })
    },
    onSuccess: (_data, { patchId }) => {
      queryClient.invalidateQueries({ queryKey: ['patch-photos', patchId] })
      queryClient.invalidateQueries({ queryKey: ['patches'] })
    },
  })
}

export function useDeletePatchPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (photo: PatchPhoto) => {
      // The database refuses this too (a patch must keep its patch photo);
      // checking here turns it into a clear message instead of a constraint
      // error, and avoids a pointless round trip.
      if (photo.is_cover) {
        throw new Error("The photo of the patch can't be removed on its own — replace it from Edit patch instead.")
      }

      const targets: StorageTarget[] = [{ bucket: 'patch-originals', path: photo.storage_path_original }]
      if (photo.storage_path_gallery) {
        targets.push({ bucket: 'patch-gallery', path: photo.storage_path_gallery })
      }

      // Row first: Postgres decides whether the photo still exists. If this
      // fails, the files are still there and still referenced.
      const { error } = await supabase.from('patch_photos').delete().eq('id', photo.id)
      if (error) throw error

      await removeStorageObjects(targets)
    },
    onSuccess: (_data, photo) => {
      queryClient.invalidateQueries({ queryKey: ['patch-photos', photo.patch_id] })
      queryClient.invalidateQueries({ queryKey: ['patches'] })
    },
  })
}
