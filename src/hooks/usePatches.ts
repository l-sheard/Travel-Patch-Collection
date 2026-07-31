import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { NewPatchInput, Patch, PatchWithPhotos } from '../types/patch'
import { useAuth } from '../context/AuthProvider'

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

export function useCreatePatch() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewPatchInput) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('patches')
        .insert({ ...input, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as Patch
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PATCHES_KEY })
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
      const { error } = await supabase.from('patches').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PATCHES_KEY })
    },
  })
}
