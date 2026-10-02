// Storage/Postgres consistency rules for the photo and dish flows.
//
// These cover the client half of the contract: the order operations happen in,
// what gets compensated when a step fails, and that the photo of the patch is
// never deleted or reassigned outside replace_patch_cover(). The database half
// (the partial unique index and the deferred constraint trigger) needs a real
// Postgres and is verified by supabase/verify-invariants.sql.
//
// Deliberately one file rather than one per hook: every test here asserts the
// same cross-hook rule, and they share a single Supabase mock.

import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { NewPatchInput, PatchDish, PatchPhoto } from '../types/patch'

const USER_ID = '11111111-1111-1111-1111-111111111111'
const PATCH_ID = '22222222-2222-2222-2222-222222222222'

const h = vi.hoisted(() => {
  const order: string[] = []
  const tableCalls: { table: string; op: string; payload?: unknown }[] = []
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = []
  const removeCalls: { bucket: string; paths: string[] }[] = []
  const uploadCalls: { bucket: string; path: string }[] = []

  const tableResults = new Map<string, { data?: unknown; error?: unknown }>()
  const rpcResults = new Map<string, { data?: unknown; error?: unknown }>()
  const storageErrors = new Map<string, unknown>()

  function reset() {
    order.length = 0
    tableCalls.length = 0
    rpcCalls.length = 0
    removeCalls.length = 0
    uploadCalls.length = 0
    tableResults.clear()
    rpcResults.clear()
    storageErrors.clear()
  }

  function tableChain(table: string) {
    const result = () => tableResults.get(table) ?? { data: [{ id: 'row' }], error: null }
    const chain = {
      insert(payload: unknown) {
        order.push(`db:insert:${table}`)
        tableCalls.push({ table, op: 'insert', payload })
        return chain
      },
      update(payload: unknown) {
        order.push(`db:update:${table}`)
        tableCalls.push({ table, op: 'update', payload })
        return chain
      },
      delete() {
        order.push(`db:delete:${table}`)
        tableCalls.push({ table, op: 'delete' })
        return chain
      },
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      single: () => Promise.resolve(result()),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    }
    return chain
  }

  const supabase = {
    from: (table: string) => tableChain(table),
    // Thenable *and* chainable: some call sites await the rpc directly (it
    // returns a set of rows), others add .single() for a one-row function.
    rpc: (fn: string, args: Record<string, unknown>) => {
      order.push(`rpc:${fn}`)
      rpcCalls.push({ fn, args })
      const configured = () => rpcResults.get(fn)
      return {
        single: () => Promise.resolve(configured() ?? { data: { id: 'created-patch' }, error: null }),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(configured() ?? { data: [], error: null }).then(resolve, reject),
      }
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string) => {
          order.push(`storage:upload:${bucket}`)
          uploadCalls.push({ bucket, path })
          return Promise.resolve({ error: storageErrors.get(`upload:${bucket}`) ?? null })
        },
        remove: (paths: string[]) => {
          order.push(`storage:remove:${bucket}`)
          removeCalls.push({ bucket, paths })
          return Promise.resolve({ error: storageErrors.get(`remove:${bucket}`) ?? null })
        },
      }),
    },
  }

  return {
    supabase,
    order,
    tableCalls,
    rpcCalls,
    removeCalls,
    uploadCalls,
    tableResults,
    rpcResults,
    storageErrors,
    reset,
  }
})

vi.mock('../lib/supabaseClient', () => ({ supabase: h.supabase }))
vi.mock('../context/AuthProvider', () => ({ useAuth: () => ({ user: { id: USER_ID } }) }))
vi.mock('../lib/galleryProcessing', () => ({
  processGalleryImage: vi.fn(),
  reprocessGalleryImage: vi.fn(),
}))
// Rendering the Add patch form would otherwise hit the geocoding API.
vi.mock('../lib/geocode', () => ({ searchLocations: vi.fn().mockResolvedValue([]) }))

const { useDeletePatchPhoto, useReplacePatchCover, useUploadTripPhoto } = await import('./usePatchPhotos')
const { useCreatePatchWithCover, useDeletePatch } = await import('./usePatches')
const { useAddPatchDish, useDeletePatchDish } = await import('./usePatchDishes')
const AddPatch = (await import('../routes/AddPatch')).default

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  return (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

function renderMutation<T>(hook: () => T): T {
  const { result } = renderHook(hook, { wrapper })
  return result.current
}

function photo(overrides: Partial<PatchPhoto> = {}): PatchPhoto {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    patch_id: PATCH_ID,
    user_id: USER_ID,
    role: 'original',
    storage_path_original: `${USER_ID}/${PATCH_ID}/trip.jpg`,
    storage_path_gallery: null,
    gallery_status: 'done',
    embedding: null,
    phash: null,
    is_cover: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function file() {
  return new File([new Uint8Array(1)], 'patch.jpg', { type: 'image/jpeg' })
}

function patchInput(): NewPatchInput {
  return {
    location_name: 'Rome',
    country: 'Italy',
    lat: null,
    lng: null,
    trip_start_date: null,
    trip_end_date: null,
    purchased_date: null,
    companions: [],
    description: null,
    trip_id: null,
    accommodations: [],
    restaurants: [],
    rating: null,
    review: null,
    itinerary: null,
    highlights: null,
    holiday_types: [],
    price: null,
  }
}

const indexOf = (entry: string) => h.order.indexOf(entry)

beforeEach(() => {
  cleanup()
  h.reset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // jsdom has no object-URL support, which the photo thumbnails use.
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

/** Fills in the Add patch form's required fields plus one optional trip photo,
 * and submits it. Exercises the real route, so the ordering it asserts is the
 * ordering the app actually performs. */
async function submitAddPatchForm() {
  render(<AddPatch />, { wrapper })

  fireEvent.change(screen.getByPlaceholderText('e.g. Florence'), { target: { value: 'Rome' } })

  const fileInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))
  // [0] is "Photo of the patch", [1] is "Other trip photos".
  expect(fileInputs.length).toBe(2)
  fireEvent.change(fileInputs[0], { target: { files: [file()] } })
  fireEvent.change(fileInputs[1], { target: { files: [file()] } })

  fireEvent.click(screen.getByRole('button', { name: /save patch/i }))
  await waitFor(() => expect(h.order).toContain('rpc:create_patch_with_cover'))
}

describe('creating a patch with its patch photo', () => {
  it('uploads the patch photo before any row exists', async () => {
    const create = renderMutation(useCreatePatchWithCover)
    await create.mutateAsync({ input: patchInput(), coverFile: file() })

    expect(indexOf('storage:upload:patch-originals')).toBeGreaterThanOrEqual(0)
    expect(indexOf('storage:upload:patch-originals')).toBeLessThan(indexOf('rpc:create_patch_with_cover'))
  })

  it('creates the patch and its one cover row in a single transaction', async () => {
    const create = renderMutation(useCreatePatchWithCover)
    await create.mutateAsync({ input: patchInput(), coverFile: file() })

    const rpc = h.rpcCalls.filter((c) => c.fn === 'create_patch_with_cover')
    expect(rpc).toHaveLength(1)
    expect(rpc[0].args.p_patch_id).toEqual(expect.any(String))
    expect(rpc[0].args.p_photo_id).toEqual(expect.any(String))
    expect(rpc[0].args.p_storage_path_original).toBe(h.uploadCalls[0].path)

    // Neither row is written separately — that's the whole point of the RPC.
    expect(h.tableCalls.filter((c) => c.op === 'insert')).toEqual([])
  })

  it('creates no patch when the cover upload fails', async () => {
    h.storageErrors.set('upload:patch-originals', new Error('upload exploded'))

    const create = renderMutation(useCreatePatchWithCover)
    await expect(create.mutateAsync({ input: patchInput(), coverFile: file() })).rejects.toThrow('upload exploded')

    expect(h.rpcCalls).toEqual([])
    expect(h.tableCalls).toEqual([])
  })

  it('creates neither row and takes the upload back out when the transaction fails', async () => {
    h.rpcResults.set('create_patch_with_cover', { data: null, error: new Error('transaction rolled back') })

    const create = renderMutation(useCreatePatchWithCover)
    await expect(create.mutateAsync({ input: patchInput(), coverFile: file() })).rejects.toThrow(
      'transaction rolled back',
    )

    expect(h.tableCalls.filter((c) => c.op === 'insert')).toEqual([])
    expect(h.removeCalls).toEqual([{ bucket: 'patch-originals', paths: [h.uploadCalls[0].path] }])
  })
})

describe('the Add patch flow', () => {
  it('adds optional trip photos only after the patch and cover exist', async () => {
    await submitAddPatchForm()
    await waitFor(() => expect(h.order).toContain('db:insert:patch_photos'))

    expect(indexOf('rpc:create_patch_with_cover')).toBeLessThan(indexOf('db:insert:patch_photos'))
    expect(h.rpcCalls.filter((c) => c.fn === 'create_patch_with_cover')).toHaveLength(1)
  })

  it('keeps those trip photos as non-cover photos', async () => {
    await submitAddPatchForm()
    await waitFor(() => expect(h.order).toContain('db:insert:patch_photos'))

    const inserts = h.tableCalls.filter((c) => c.table === 'patch_photos' && c.op === 'insert')
    expect(inserts).toHaveLength(1)
    expect(inserts[0].payload).toMatchObject({ is_cover: false })
  })

  it('adds no trip photos when the core transaction fails', async () => {
    h.rpcResults.set('create_patch_with_cover', { data: null, error: new Error('transaction rolled back') })

    await submitAddPatchForm()
    await waitFor(() => expect(h.removeCalls).toHaveLength(1))

    expect(h.tableCalls.filter((c) => c.op === 'insert')).toEqual([])
    expect(await screen.findByText('transaction rolled back')).toBeTruthy()
  })
})

describe('replacing the photo of the patch', () => {
  it('uploads the new image before the database swap', async () => {
    const replace = renderMutation(useReplacePatchCover)
    await replace.mutateAsync({ patchId: PATCH_ID, file: file() })

    expect(indexOf('storage:upload:patch-originals')).toBeGreaterThanOrEqual(0)
    expect(indexOf('storage:upload:patch-originals')).toBeLessThan(indexOf('rpc:replace_patch_cover'))
    expect(h.uploadCalls[0].path.startsWith(`${USER_ID}/${PATCH_ID}/`)).toBe(true)
  })

  it('deletes the outgoing image only after the swap has committed', async () => {
    h.rpcResults.set('replace_patch_cover', {
      data: [
        { bucket: 'patch-originals', path: `${USER_ID}/${PATCH_ID}/old.jpg` },
        { bucket: 'patch-gallery', path: `${USER_ID}/${PATCH_ID}/old-gallery.png` },
      ],
      error: null,
    })

    const replace = renderMutation(useReplacePatchCover)
    await replace.mutateAsync({ patchId: PATCH_ID, file: file() })

    expect(indexOf('rpc:replace_patch_cover')).toBeLessThan(indexOf('storage:remove:patch-originals'))
    expect(h.removeCalls).toEqual([
      { bucket: 'patch-originals', paths: [`${USER_ID}/${PATCH_ID}/old.jpg`] },
      { bucket: 'patch-gallery', paths: [`${USER_ID}/${PATCH_ID}/old-gallery.png`] },
    ])
  })

  it('keeps the existing cover and removes the new upload when the swap fails', async () => {
    h.rpcResults.set('replace_patch_cover', { data: null, error: new Error('swap rejected') })

    const replace = renderMutation(useReplacePatchCover)
    await expect(replace.mutateAsync({ patchId: PATCH_ID, file: file() })).rejects.toThrow('swap rejected')

    const uploadedPath = h.uploadCalls[0].path
    expect(h.removeCalls).toEqual([{ bucket: 'patch-originals', paths: [uploadedPath] }])
  })

  it('never promotes or demotes an existing photo row', async () => {
    h.rpcResults.set('replace_patch_cover', { data: [], error: null })

    const replace = renderMutation(useReplacePatchCover)
    await replace.mutateAsync({ patchId: PATCH_ID, file: file() })

    expect(h.tableCalls.filter((c) => c.table === 'patch_photos' && c.op === 'update')).toEqual([])
  })
})

describe('adding a trip photo', () => {
  it('always inserts as a non-cover photo', async () => {
    const upload = renderMutation(useUploadTripPhoto)
    await upload.mutateAsync({ patchId: PATCH_ID, file: file() })

    const insert = h.tableCalls.find((c) => c.table === 'patch_photos' && c.op === 'insert')
    expect(insert?.payload).toMatchObject({ is_cover: false })
    expect(indexOf('storage:upload:patch-originals')).toBeLessThan(indexOf('db:insert:patch_photos'))
  })

  it('removes the uploaded file if the insert fails', async () => {
    h.tableResults.set('patch_photos', { data: null, error: new Error('insert rejected') })

    const upload = renderMutation(useUploadTripPhoto)
    await expect(upload.mutateAsync({ patchId: PATCH_ID, file: file() })).rejects.toThrow('insert rejected')

    expect(h.removeCalls).toEqual([{ bucket: 'patch-originals', paths: [h.uploadCalls[0].path] }])
  })
})

describe('deleting a photo', () => {
  it('refuses to delete the photo of the patch', async () => {
    const del = renderMutation(useDeletePatchPhoto)

    await expect(del.mutateAsync(photo({ is_cover: true }))).rejects.toThrow(/replace it/i)
    expect(h.tableCalls).toEqual([])
    expect(h.removeCalls).toEqual([])
  })

  it('deletes a trip photo row before its files', async () => {
    const del = renderMutation(useDeletePatchPhoto)
    await del.mutateAsync(photo({ storage_path_gallery: `${USER_ID}/${PATCH_ID}/trip-gallery.png` }))

    expect(indexOf('db:delete:patch_photos')).toBeLessThan(indexOf('storage:remove:patch-originals'))
    expect(h.removeCalls).toEqual([
      { bucket: 'patch-originals', paths: [`${USER_ID}/${PATCH_ID}/trip.jpg`] },
      { bucket: 'patch-gallery', paths: [`${USER_ID}/${PATCH_ID}/trip-gallery.png`] },
    ])
  })

  it('leaves the files in place when the row delete fails', async () => {
    h.tableResults.set('patch_photos', { data: null, error: new Error('delete rejected') })

    const del = renderMutation(useDeletePatchPhoto)
    await expect(del.mutateAsync(photo())).rejects.toThrow('delete rejected')

    expect(h.removeCalls).toEqual([])
  })
})

describe('deleting a whole patch', () => {
  it('cleans up exactly the objects the delete reported, afterwards', async () => {
    h.rpcResults.set('delete_patch_returning_storage_paths', {
      data: [
        { bucket: 'patch-originals', path: `${USER_ID}/${PATCH_ID}/cover.jpg` },
        { bucket: 'patch-originals', path: `${USER_ID}/${PATCH_ID}/trip.jpg` },
        { bucket: 'patch-gallery', path: `${USER_ID}/${PATCH_ID}/cover-gallery.png` },
        { bucket: 'patch-dishes', path: `${USER_ID}/${PATCH_ID}/dish.jpg` },
      ],
      error: null,
    })

    const del = renderMutation(useDeletePatch)
    await del.mutateAsync(PATCH_ID)

    expect(indexOf('rpc:delete_patch_returning_storage_paths')).toBeLessThan(
      indexOf('storage:remove:patch-originals'),
    )
    expect(h.removeCalls).toEqual([
      {
        bucket: 'patch-originals',
        paths: [`${USER_ID}/${PATCH_ID}/cover.jpg`, `${USER_ID}/${PATCH_ID}/trip.jpg`],
      },
      { bucket: 'patch-gallery', paths: [`${USER_ID}/${PATCH_ID}/cover-gallery.png`] },
      { bucket: 'patch-dishes', paths: [`${USER_ID}/${PATCH_ID}/dish.jpg`] },
    ])
  })

  it('does not touch storage when the delete fails', async () => {
    h.rpcResults.set('delete_patch_returning_storage_paths', { data: null, error: new Error('delete rejected') })

    const del = renderMutation(useDeletePatch)
    await expect(del.mutateAsync(PATCH_ID)).rejects.toThrow('delete rejected')

    expect(h.removeCalls).toEqual([])
  })

  it('still reports success when cleanup leaves orphans behind', async () => {
    h.rpcResults.set('delete_patch_returning_storage_paths', {
      data: [{ bucket: 'patch-originals', path: `${USER_ID}/${PATCH_ID}/cover.jpg` }],
      error: null,
    })
    h.storageErrors.set('remove:patch-originals', new Error('storage down'))

    const del = renderMutation(useDeletePatch)
    await expect(del.mutateAsync(PATCH_ID)).resolves.toBeUndefined()
  })
})

describe('dish photos', () => {
  it('removes the uploaded photo if the dish row insert fails', async () => {
    h.tableResults.set('patch_dishes', { data: null, error: new Error('insert rejected') })

    const add = renderMutation(useAddPatchDish)
    await expect(add.mutateAsync({ patchId: PATCH_ID, name: 'Tava', file: file() })).rejects.toThrow(
      'insert rejected',
    )

    expect(h.removeCalls).toEqual([{ bucket: 'patch-dishes', paths: [h.uploadCalls[0].path] }])
  })

  it('touches no storage at all for a text-only dish', async () => {
    const add = renderMutation(useAddPatchDish)
    await add.mutateAsync({ patchId: PATCH_ID, name: 'Tava', file: null })

    expect(h.uploadCalls).toEqual([])
    expect(h.removeCalls).toEqual([])
  })

  it('deletes the dish row before its photo', async () => {
    const dish: PatchDish = {
      id: '44444444-4444-4444-4444-444444444444',
      patch_id: PATCH_ID,
      user_id: USER_ID,
      name: 'Tava',
      storage_path: `${USER_ID}/${PATCH_ID}/dish.jpg`,
      created_at: '2026-01-01T00:00:00Z',
    }

    const del = renderMutation(useDeletePatchDish)
    await del.mutateAsync(dish)

    await waitFor(() => expect(h.removeCalls.length).toBe(1))
    expect(indexOf('db:delete:patch_dishes')).toBeLessThan(indexOf('storage:remove:patch-dishes'))
  })
})
