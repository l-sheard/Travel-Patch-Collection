import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { NewTripInput, PatchWithPhotos, Trip } from '../types/patch'
import { useAuth } from '../context/AuthProvider'

const TRIPS_KEY = ['trips']

export function useTrips() {
  return useQuery({
    queryKey: TRIPS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('*').order('name', { ascending: true })
      if (error) throw error
      return data as Trip[]
    },
  })
}

export function useTrip(id: string | null | undefined) {
  return useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('*').eq('id', id as string).single()
      if (error) throw error
      return data as Trip
    },
    enabled: !!id,
  })
}

export function useCreateTrip() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase.from('trips').insert({ name, user_id: user.id }).select().single()
      if (error) throw error
      return data as Trip
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY })
    },
  })
}

export function useUpdateTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<NewTripInput> }) => {
      const { data, error } = await supabase.from('trips').update(input).eq('id', id).select().single()
      if (error) throw error
      return data as Trip
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY })
      queryClient.invalidateQueries({ queryKey: ['trip', data.id] })
    },
  })
}

/** Resolves a free-text trip name to an id, creating the trip if it doesn't exist yet. */
export function useResolveTripId() {
  const { data: trips } = useTrips()
  const createTrip = useCreateTrip()

  return async function resolveTripId(tripName: string): Promise<string | null> {
    const trimmed = tripName.trim()
    if (!trimmed) return null
    const existing = trips?.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing.id
    const created = await createTrip.mutateAsync(trimmed)
    return created.id
  }
}

/** Other patches sharing the same trip, for "part of this trip" links on Patch Detail. */
export function useTripSiblingPatches(tripId: string | null | undefined, excludeId: string | undefined) {
  return useQuery({
    queryKey: ['trip-patches', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patches')
        .select('*, patch_photos(*)')
        .eq('trip_id', tripId as string)
        .order('trip_start_date', { ascending: true })
      if (error) throw error
      return (data as PatchWithPhotos[]).filter((p) => p.id !== excludeId)
    },
    enabled: !!tripId,
  })
}
