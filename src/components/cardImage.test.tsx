// Which image the dashboard cards ask for.
//
// Cards render at ~163-224 CSS px, so they should take the thumbnail whenever
// one exists and only fall back to larger assets for photos that predate it.

import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen } from '@testing-library/react'
import type { PatchPhoto, PatchWithPhotos, Trip } from '../types/patch'

const h = vi.hoisted(() => ({ requested: [] as { bucket: string; path: string | null | undefined }[] }))

vi.mock('../hooks/usePhotoUrl', () => ({
  usePhotoUrl: (bucket: string, path: string | null | undefined) => {
    h.requested.push({ bucket, path })
    return { data: path ? `https://signed/${path}` : undefined }
  },
}))
// Leaflet needs a real DOM map; only the popup's contents matter here.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
}))
vi.mock('leaflet', () => ({ default: { divIcon: () => ({}) } }))

const PatchCard = (await import('./PatchCard')).default
const TripCard = (await import('./TripCard')).default
const PatchMap = (await import('./PatchMap')).default

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

function photo(overrides: Partial<PatchPhoto> = {}): PatchPhoto {
  return {
    id: 'photo-1',
    patch_id: 'patch-1',
    user_id: 'user-1',
    role: 'original',
    storage_path_original: 'user-1/patch-1/photo-1.jpg',
    storage_path_gallery: 'user-1/patch-1/photo-1-gallery.png',
    storage_path_thumb: 'user-1/patch-1/photo-1-thumb.webp',
    gallery_status: 'done',
    embedding: null,
    phash: null,
    is_cover: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function patch(photos: PatchPhoto[]): PatchWithPhotos {
  return {
    id: 'patch-1',
    user_id: 'user-1',
    trip_id: null,
    location_name: 'Rome',
    country: 'Italy',
    lat: null,
    lng: null,
    geocode_raw: null,
    trip_start_date: null,
    trip_end_date: null,
    purchased_date: null,
    companions: [],
    description: null,
    accommodations: [],
    restaurants: [],
    rating: null,
    review: null,
    itinerary: null,
    highlights: null,
    holiday_types: [],
    price: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    patch_photos: photos,
  }
}

function trip(photos: PatchPhoto[]): Trip & { patches: PatchWithPhotos[] } {
  return {
    id: 'trip-1',
    user_id: 'user-1',
    name: 'Italy 2026',
    itinerary: null,
    highlights: null,
    trip_review: null,
    rating: null,
    price: null,
    created_at: '2026-01-01T00:00:00Z',
    patches: [patch(photos)],
  }
}

const asked = () => h.requested[0]

beforeEach(() => {
  cleanup()
  h.requested.length = 0
})

describe('PatchCard image selection', () => {
  it('prefers the thumbnail', () => {
    render(<PatchCard patch={patch([photo()])} />, { wrapper })
    expect(asked()).toEqual({ bucket: 'patch-gallery', path: 'user-1/patch-1/photo-1-thumb.webp' })
  })

  it('falls back to the gallery image for photos processed before thumbnails', () => {
    render(<PatchCard patch={patch([photo({ storage_path_thumb: null })])} />, { wrapper })
    expect(asked()).toEqual({ bucket: 'patch-gallery', path: 'user-1/patch-1/photo-1-gallery.png' })
  })

  it('falls back to the original when nothing has been processed yet', () => {
    render(<PatchCard patch={patch([photo({ storage_path_thumb: null, storage_path_gallery: null })])} />, {
      wrapper,
    })
    expect(asked()).toEqual({ bucket: 'patch-originals', path: 'user-1/patch-1/photo-1.jpg' })
  })

  // Above the fold on the dashboard, so it must not be deferred.
  it('loads eagerly and decodes off the main thread', () => {
    render(<PatchCard patch={patch([photo()])} />, { wrapper })
    const img = screen.getByAltText('Rome')
    expect(img.getAttribute('loading')).toBeNull()
    expect(img.getAttribute('decoding')).toBe('async')
  })
})

describe('TripCard image selection', () => {
  it('prefers the thumbnail of its first patch', () => {
    render(<TripCard trip={trip([photo()])} />, { wrapper })
    expect(asked()).toEqual({ bucket: 'patch-gallery', path: 'user-1/patch-1/photo-1-thumb.webp' })
  })

  it('falls back to the gallery image', () => {
    render(<TripCard trip={trip([photo({ storage_path_thumb: null })])} />, { wrapper })
    expect(asked()).toEqual({ bucket: 'patch-gallery', path: 'user-1/patch-1/photo-1-gallery.png' })
  })

  // Below the patch grid on the dashboard, so deferring it leaves bandwidth
  // for the thumbnails the user can actually see.
  it('is lazy-loaded', () => {
    render(<TripCard trip={trip([photo()])} />, { wrapper })
    const img = screen.getByAltText('Italy 2026')
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('decoding')).toBe('async')
  })
})

describe('map popup image selection', () => {
  const pinned = (photos: PatchPhoto[]) => [{ ...patch(photos), lat: 41.9, lng: 12.5 }]

  it('prefers the thumbnail', () => {
    render(<PatchMap patches={pinned([photo()])} />, { wrapper })
    expect(asked()).toEqual({ bucket: 'patch-gallery', path: 'user-1/patch-1/photo-1-thumb.webp' })
  })

  it('falls back to the gallery image', () => {
    render(<PatchMap patches={pinned([photo({ storage_path_thumb: null })])} />, { wrapper })
    expect(asked()).toEqual({ bucket: 'patch-gallery', path: 'user-1/patch-1/photo-1-gallery.png' })
  })

  it('falls back to the original when nothing has been processed yet', () => {
    render(<PatchMap patches={pinned([photo({ storage_path_thumb: null, storage_path_gallery: null })])} />, {
      wrapper,
    })
    expect(asked()).toEqual({ bucket: 'patch-originals', path: 'user-1/patch-1/photo-1.jpg' })
  })
})
