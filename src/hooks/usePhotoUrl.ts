import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type PhotoBucket = 'patch-originals' | 'patch-gallery'

export function usePhotoUrl(bucket: PhotoBucket, path: string | null | undefined) {
  return useQuery({
    queryKey: ['photo-url', bucket, path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path as string, 3600)
      if (error) throw error
      return data.signedUrl
    },
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
  })
}
