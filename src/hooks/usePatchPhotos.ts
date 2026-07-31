import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { PatchPhoto } from '../types/patch'
import { useAuth } from '../context/AuthProvider'
import { processGalleryImage } from '../lib/galleryProcessing'

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

export function useUploadPatchPhoto() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      patchId,
      file,
      isCover,
    }: {
      patchId: string
      file: File
      isCover: boolean
    }) => {
      if (!user) throw new Error('Not signed in')
      const photoId = crypto.randomUUID()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${patchId}/${photoId}.${ext}`

      if (isCover) {
        await supabase.from('patch_photos').update({ is_cover: false }).eq('patch_id', patchId).eq('is_cover', true)
      }

      const { error: uploadError } = await supabase.storage
        .from('patch-originals')
        .upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('patch_photos')
        .insert({
          id: photoId,
          patch_id: patchId,
          user_id: user.id,
          role: 'original',
          storage_path_original: path,
          is_cover: isCover,
        })
        .select()
        .single()
      if (error) throw error
      return data as PatchPhoto
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patch-photos', variables.patchId] })
      queryClient.invalidateQueries({ queryKey: ['patches'] })

      if (variables.isCover && user) {
        processGalleryImage({
          photoId: data.id,
          patchId: variables.patchId,
          userId: user.id,
          originalFile: variables.file,
          queryClient,
        })
      }
    },
  })
}
