import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { PatchDish } from '../types/patch'
import { useAuth } from '../context/AuthProvider'
import { dishPhotoPath, fileExtension } from '../lib/storagePaths'
import { removeStorageObjects, uploadThenRecord } from '../lib/storageLifecycle'

export function usePatchDishes(patchId: string | undefined) {
  return useQuery({
    queryKey: ['patch-dishes', patchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patch_dishes')
        .select('*')
        .eq('patch_id', patchId as string)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as PatchDish[]
    },
    enabled: !!patchId,
  })
}

export function useAddPatchDish() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      patchId,
      name,
      file,
    }: {
      patchId: string
      name: string
      file: File | null
    }) => {
      if (!user) throw new Error('Not signed in')
      const dishId = crypto.randomUUID()

      const insertDish = async (storagePath: string | null) => {
        const { data, error } = await supabase
          .from('patch_dishes')
          .insert({ id: dishId, patch_id: patchId, user_id: user.id, name, storage_path: storagePath })
          .select()
          .single()
        if (error) throw error
        return data as PatchDish
      }

      // A dish can be text-only, in which case no storage is involved at all
      // and the insert is simply atomic on its own.
      if (!file) return insertDish(null)

      const path = dishPhotoPath(user.id, patchId, dishId, fileExtension(file))
      return uploadThenRecord({
        bucket: 'patch-dishes',
        path,
        file,
        record: () => insertDish(path),
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patch-dishes', variables.patchId] })
    },
  })
}

export function useDeletePatchDish() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (dish: PatchDish) => {
      // Row first, then the file: if the delete fails the photo is still there
      // and still referenced, rather than the row outliving its image.
      const { error } = await supabase.from('patch_dishes').delete().eq('id', dish.id)
      if (error) throw error

      if (dish.storage_path) {
        await removeStorageObjects([{ bucket: 'patch-dishes', path: dish.storage_path }])
      }
    },
    onSuccess: (_data, dish) => {
      queryClient.invalidateQueries({ queryKey: ['patch-dishes', dish.patch_id] })
    },
  })
}
