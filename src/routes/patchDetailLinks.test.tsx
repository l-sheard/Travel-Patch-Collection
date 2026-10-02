// How PatchDetail renders the two user-entered URLs it puts in an href.
//
// safeExternalUrl has its own unit tests; this is here so that reintroducing
// `href={acc.url}` fails the suite rather than quietly shipping.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { cleanup, render, screen } from '@testing-library/react'
import type { Accommodation, PatchWithPhotos, Restaurant } from '../types/patch'

const h = vi.hoisted(() => ({ patch: null as unknown }))

vi.mock('../hooks/usePatches', () => ({
  usePatch: () => ({ data: h.patch, isLoading: false, isError: false }),
  useDeletePatch: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../hooks/usePatchPhotos', () => ({
  usePatchPhotos: () => ({ data: [] }),
  useDeletePatchPhoto: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../hooks/usePatchDishes', () => ({
  usePatchDishes: () => ({ data: [] }),
  useDeletePatchDish: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../hooks/useTrips', () => ({ useTrip: () => ({ data: undefined }) }))
vi.mock('../hooks/usePhotoUrl', () => ({ usePhotoUrl: () => ({ data: undefined }) }))
vi.mock('../context/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
vi.mock('../lib/galleryProcessing', () => ({ reprocessGalleryImage: vi.fn() }))
// Pulls in Leaflet, which needs a real map container.
vi.mock('../components/LazyPatchMap', () => ({ default: () => null }))

const PatchDetail = (await import('./PatchDetail')).default

function patchWith(accommodations: Accommodation[], restaurants: Restaurant[]): PatchWithPhotos {
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
    accommodations,
    restaurants,
    rating: null,
    review: null,
    itinerary: null,
    highlights: null,
    holiday_types: [],
    price: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    patch_photos: [],
  }
}

function accommodation(url: string | null): Accommodation {
  return { name: 'Hotel Roma', url, rating: null, notes: null, nights: null, people: null }
}

function renderDetail(accommodations: Accommodation[], restaurants: Restaurant[] = []) {
  h.patch = patchWith(accommodations, restaurants)
  render(
    <MemoryRouter initialEntries={['/patches/patch-1']}>
      <Routes>
        <Route path="/patches/:id" element={<PatchDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The anchor wrapping a given label, or null when it's rendered as text. */
function linkFor(label: string): HTMLAnchorElement | null {
  return screen.getByText(label).closest('a')
}

beforeEach(() => {
  cleanup()
  h.patch = null
})

describe('accommodation links', () => {
  it('links an https URL', () => {
    renderDetail([accommodation('https://hotelroma.example/book?n=2')])
    expect(linkFor('Hotel Roma')?.getAttribute('href')).toBe('https://hotelroma.example/book?n=2')
  })

  it('links an http URL', () => {
    renderDetail([accommodation('http://hotelroma.example/')])
    expect(linkFor('Hotel Roma')?.getAttribute('href')).toBe('http://hotelroma.example/')
  })

  it('opens external links safely', () => {
    renderDetail([accommodation('https://hotelroma.example/')])
    const link = linkFor('Hotel Roma')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['tab-obfuscated javascript:', 'java\tscript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['file:', 'file:///etc/passwd'],
    ['a bare hostname', 'hotelroma.example'],
    ['a relative path', '/patches/2'],
    ['nonsense', 'definitely not a url'],
  ])('renders the name as plain text for %s', (_label, url) => {
    renderDetail([accommodation(url)])
    // Still visible — refusing the link must not hide the entry.
    expect(screen.getByText('Hotel Roma')).toBeTruthy()
    expect(linkFor('Hotel Roma')).toBeNull()
  })

  it('still renders an entry with no URL at all', () => {
    renderDetail([accommodation(null)])
    expect(screen.getByText('Hotel Roma')).toBeTruthy()
    expect(linkFor('Hotel Roma')).toBeNull()
  })
})

describe('restaurant links', () => {
  it('links an https URL', () => {
    renderDetail([], [{ name: 'Da Enzo', url: 'https://daenzo.example/' }])
    expect(linkFor('Da Enzo')?.getAttribute('href')).toBe('https://daenzo.example/')
  })

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,x'],
    ['file:', 'file:///etc/passwd'],
    ['a bare hostname', 'daenzo.example'],
  ])('renders the name as plain text for %s', (_label, url) => {
    renderDetail([], [{ name: 'Da Enzo', url }])
    expect(screen.getByText('Da Enzo')).toBeTruthy()
    expect(linkFor('Da Enzo')).toBeNull()
  })
})

// A blanket guard: whatever the markup around these ends up looking like, no
// anchor on the page may carry a scheme the browser would execute locally.
describe('no executable href survives anywhere on the page', () => {
  it('leaves no javascript:/data:/file: anchor', () => {
    renderDetail(
      [accommodation('javascript:alert(1)')],
      [
        { name: 'Da Enzo', url: 'data:text/html,x' },
        { name: 'Roscioli', url: 'file:///etc/passwd' },
        { name: 'Armando', url: 'https://armando.example/' },
      ],
    )

    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(href).not.toMatch(/^\s*(javascript|data|file|vbscript):/i)
    }
    // The one good link is still there, so this isn't passing by rendering nothing.
    expect(hrefs).toContain('https://armando.example/')
  })
})
