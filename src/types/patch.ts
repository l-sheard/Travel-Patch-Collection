export type GalleryStatus = 'pending' | 'processing' | 'done' | 'failed'
export type PhotoRole = 'original' | 'reference'

export type Accommodation = {
  name: string
  url: string | null
  rating: number | null
  notes: string | null
}

export type Restaurant = {
  name: string
  url: string | null
}

export type Trip = {
  id: string
  user_id: string
  name: string
  itinerary: string | null
  highlights: string | null
  trip_review: string | null
  rating: number | null
  created_at: string
}

export type Patch = {
  id: string
  user_id: string
  trip_id: string | null
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
  accommodations: Accommodation[]
  restaurants: Restaurant[]
  rating: number | null
  review: string | null
  itinerary: string | null
  highlights: string | null
  holiday_types: string[]
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
  embedding: number[] | string | null
  phash: string | null
  is_cover: boolean
  created_at: string
}

export type PatchDish = {
  id: string
  patch_id: string
  user_id: string
  name: string
  storage_path: string
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
  | 'trip_id'
  | 'accommodations'
  | 'restaurants'
  | 'rating'
  | 'review'
  | 'itinerary'
  | 'highlights'
  | 'holiday_types'
> & { geocode_raw?: unknown }

export type NewTripInput = Pick<Trip, 'name' | 'itinerary' | 'highlights' | 'trip_review' | 'rating'>

export type PatchWithPhotos = Patch & { patch_photos: PatchPhoto[] }
