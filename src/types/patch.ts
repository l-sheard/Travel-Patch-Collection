export type GalleryStatus = 'pending' | 'processing' | 'done' | 'failed'
export type PhotoRole = 'original' | 'reference'

export type Patch = {
  id: string
  user_id: string
  location_name: string
  country: string | null
  lat: number | null
  lng: number | null
  geocode_raw: unknown
  trip_start_date: string | null
  trip_end_date: string | null
  purchased_date: string | null
  companions: string[]
  description: string | null
  created_at: string
  updated_at: string
}

export type PatchPhoto = {
  id: string
  patch_id: string
  user_id: string
  role: PhotoRole
  storage_path_original: string
  storage_path_gallery: string | null
  gallery_status: GalleryStatus
  embedding: number[] | null
  phash: number | null
  is_cover: boolean
  created_at: string
}

export type NewPatchInput = Pick<
  Patch,
  | 'location_name'
  | 'country'
  | 'lat'
  | 'lng'
  | 'trip_start_date'
  | 'trip_end_date'
  | 'purchased_date'
  | 'companions'
  | 'description'
> & { geocode_raw?: unknown }

export type PatchWithPhotos = Patch & { patch_photos: PatchPhoto[] }
