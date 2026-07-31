import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { PatchDish } from '../types/patch'
import { useAuth } from '../context/AuthProvider'

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
    mutationFn: async ({ patchId, name, file }: { patchId: string; name: string; file: File }) => {
      if (!user) throw new Error('Not signed in')
      const dishId = crypto.randomUUID()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${patchId}/${dishId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('patch-dishes')
        .upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('patch_dishes')
        .insert({ id: dishId, patch_id: patchId, user_id: user.id, name, storage_path: path })
        .select()
        .single()
      if (error) throw error
      return data as PatchDish
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
      await supabase.storage.from('patch-dishes').remove([dish.storage_path])
      const { error } = await supabase.from('patch_dishes').delete().eq('id', dish.id)
      if (error) throw error
    },
    onSuccess: (_data, dish) => {
      queryClient.invalidateQueries({ queryKey: ['patch-dishes', dish.patch_id] })
    },
  })
}
