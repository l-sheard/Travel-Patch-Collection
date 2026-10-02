import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { NewPatchInput, Patch, PatchWithPhotos } from '../types/patch'
import { useAuth } from '../context/AuthProvider'
import { processGalleryImage } from '../lib/galleryProcessing'
import { fileExtension, originalPhotoPath } from '../lib/storagePaths'
import { removeStorageObjects, uploadThenRecord, type StorageTarget } from '../lib/storageLifecycle'

const PATCHES_KEY = ['patches']

export function usePatches() {
  return useQuery({
    queryKey: PATCHES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patches')
        .select('*, patch_photos(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as PatchWithPhotos[]
    },
  })
}

export function usePatch(id: string | undefined) {
  return useQuery({
    queryKey: ['patch', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('patches').select('*').eq('id', id).single()
      if (error) throw error
      return data as Patch
    },
    enabled: !!id,
  })
}

/** Creates a patch and its mandatory photo of the physical patch together.
 *
 * A patch without that photo isn't a valid patch here — no gallery sticker and
 * nothing to scan against — so the row is never committed on its own. The
 * image is uploaded first and both rows then go in one transaction
 * (create_patch_with_cover in supabase/schema.sql): a failed upload creates no
 * patch, and a failed transaction creates neither row and takes the uploaded
 * object back out. */
export function useCreatePatchWithCover() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ input, coverFile }: { input: NewPatchInput; coverFile: File }) => {
      if (!user) throw new Error('Not signed in')
      const patchId = crypto.randomUUID()
      const photoId = crypto.randomUUID()
      const storagePathOriginal = originalPhotoPath(user.id, patchId, photoId, fileExtension(coverFile))

      const patch = await uploadThenRecord({
        bucket: 'patch-originals',
        path: storagePathOriginal,
        file: coverFile,
        record: async () => {
          const { data, error } = await supabase
            .rpc('create_patch_with_cover', {
              p_patch_id: patchId,
              p_patch: input,
              p_photo_id: photoId,
              p_storage_path_original: storagePathOriginal,
            })
            .single()
          if (error) throw error
          return data as Patch
        },
      })

      return { patch, photoId, storagePathOriginal }
    },
    onSuccess: ({ patch, photoId, storagePathOriginal }) => {
      queryClient.invalidateQueries({ queryKey: PATCHES_KEY })

      if (!user) return
      processGalleryImage({
        photoId,
        patchId: patch.id,
        userId: user.id,
        storagePathOriginal,
        queryClient,
      })
    },
  })
}

export function useUpdatePatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<NewPatchInput> }) => {
      const { data, error } = await supabase.from('patches').update(input).eq('id', id).select().single()
      if (error) throw error
      return data as Patch
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PATCHES_KEY })
      queryClient.invalidateQueries({ queryKey: ['patch', data.id] })
    },
  })
}

export function useDeletePatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // The patch row, its photos and its dishes all go via on-delete-cascade
      // inside the one statement, which also hands back the storage objects
      // those rows referenced — captured in the same transaction, so the
      // cleanup list can't miss a photo added while the delete was running.
      // See delete_patch_returning_storage_paths in supabase/schema.sql.
      const { data, error } = await supabase.rpc('delete_patch_returning_storage_paths', { p_patch_id: id })
      if (error) throw error

      await removeStorageObjects((data ?? []) as StorageTarget[])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PATCHES_KEY })
    },
  })
}
