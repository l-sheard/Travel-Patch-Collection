// Gallery processing: the gallery image and its dashboard thumbnail are
// produced together, but they are not equally important. The gallery image is
// what the patch page shows and what scan matching is computed from; the
// thumbnail is an optimisation. These tests pin that asymmetry — a thumbnail
// failure must never cost you the gallery image — and the storage/database
// compensation rules around both.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const USER = 'user-1'
const PATCH = 'patch-1'
const PHOTO = 'photo-1'
const GALLERY_PATH = `${USER}/${PATCH}/${PHOTO}-gallery.png`
const THUMB_PATH = `${USER}/${PATCH}/${PHOTO}-thumb.webp`

const h = vi.hoisted(() => ({
  removeBackground: vi.fn(),
  makeThumbnail: vi.fn(),
  analyze: vi.fn(),
  uploads: [] as { bucket: string; path: string; contentType?: string }[],
  removed: [] as { bucket: string; paths: string[] }[],
  updates: [] as Record<string, unknown>[],
  uploadErrors: new Map<string, unknown>(),
  // Overwritten in beforeEach; the literal avoids referencing module consts
  // from inside the hoisted factory, which runs before they exist.
  updateResult: { data: [{ id: 'photo-1' }] as unknown[] | null, error: null as unknown },
}))

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: () => {
      const chain = {
        update(payload: Record<string, unknown>) {
          h.updates.push(payload)
          return chain
        },
        eq: () => chain,
        select: () => Promise.resolve(h.updateResult),
        then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res),
      }
      return chain
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, _blob: Blob, opts?: { contentType?: string }) => {
          h.uploads.push({ bucket, path, contentType: opts?.contentType })
          return Promise.resolve({ error: h.uploadErrors.get(path) ?? null })
        },
        remove: (paths: string[]) => {
          h.removed.push({ bucket, paths })
          return Promise.resolve({ error: null })
        },
      }),
    },
  },
}))
vi.mock('./cloudflareBackgroundRemoval', () => ({ removeBackgroundViaCloudflare: h.removeBackground }))
vi.mock('./imageProcessing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./imageProcessing')>()),
  makeThumbnail: h.makeThumbnail,
}))
vi.mock('./imageMatch', () => ({ analyzePatchPhoto: h.analyze }))

const { processGalleryImage, reprocessGalleryImage } = await import('./galleryProcessing')

const queryClient = { invalidateQueries: vi.fn() } as never

function blob(type: string) {
  return new Blob([new Uint8Array(4)], { type })
}

/** Every path removed across all buckets, flattened. */
function removedPaths() {
  return h.removed.flatMap((r) => r.paths)
}

function lastUpdate() {
  return h.updates[h.updates.length - 1]
}

beforeEach(() => {
  vi.clearAllMocks()
  h.uploads.length = 0
  h.removed.length = 0
  h.updates.length = 0
  h.uploadErrors.clear()
  h.updateResult = { data: [{ id: PHOTO }], error: null }
  h.removeBackground.mockResolvedValue(blob('image/png'))
  h.makeThumbnail.mockResolvedValue(blob('image/webp'))
  h.analyze.mockResolvedValue({ embedding: [1, 2, 3], phash: 42n })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const args = {
  photoId: PHOTO,
  patchId: PATCH,
  userId: USER,
  storagePathOriginal: `${USER}/${PATCH}/${PHOTO}.jpg`,
  queryClient,
}

describe('processing a new photo', () => {
  it('uploads the gallery image and its thumbnail', async () => {
    await processGalleryImage(args)

    expect(h.uploads).toEqual([
      { bucket: 'patch-gallery', path: GALLERY_PATH, contentType: 'image/png' },
      { bucket: 'patch-gallery', path: THUMB_PATH, contentType: 'image/webp' },
    ])
  })

  it('records both paths in a single row update', async () => {
    await processGalleryImage(args)

    expect(h.updates).toHaveLength(2) // 'processing', then the result
    expect(lastUpdate()).toMatchObject({
      storage_path_gallery: GALLERY_PATH,
      storage_path_thumb: THUMB_PATH,
      gallery_status: 'done',
    })
  })

  // Canvas quietly falls back to PNG where WebP can't be encoded, so the stored
  // name has to follow the blob rather than the request.
  it('stores a PNG fallback under a .png name', async () => {
    h.makeThumbnail.mockResolvedValue(blob('image/png'))
    await processGalleryImage(args)

    const thumbUpload = h.uploads[1]
    expect(thumbUpload.path).toBe(`${USER}/${PATCH}/${PHOTO}-thumb.png`)
    expect(thumbUpload.contentType).toBe('image/png')
    expect(lastUpdate().storage_path_thumb).toBe(`${USER}/${PATCH}/${PHOTO}-thumb.png`)
  })
})

describe('thumbnail failure', () => {
  it('still saves the gallery image when the thumbnail cannot be generated', async () => {
    h.makeThumbnail.mockRejectedValue(new Error('canvas unavailable'))
    await processGalleryImage(args)

    expect(lastUpdate()).toMatchObject({
      storage_path_gallery: GALLERY_PATH,
      storage_path_thumb: null,
      gallery_status: 'done',
    })
  })

  it('still saves the gallery image when the thumbnail upload fails', async () => {
    h.uploadErrors.set(THUMB_PATH, new Error('storage rejected'))
    await processGalleryImage(args)

    expect(lastUpdate()).toMatchObject({ storage_path_gallery: GALLERY_PATH, storage_path_thumb: null })
    expect(lastUpdate().gallery_status).toBe('done')
  })

  // Losing a regenerated thumbnail shouldn't throw away the working one the
  // row already points at.
  it('keeps the existing thumbnail when regeneration fails on a reprocess', async () => {
    h.makeThumbnail.mockRejectedValue(new Error('canvas unavailable'))
    await reprocessGalleryImage({
      ...args,
      previousGalleryPath: GALLERY_PATH,
      previousThumbPath: THUMB_PATH,
    })

    expect(lastUpdate().storage_path_thumb).toBe(THUMB_PATH)
  })
})

describe('database write failure', () => {
  it('removes both newly uploaded objects and marks the photo failed', async () => {
    h.updateResult = { data: null, error: new Error('update rejected') }
    await processGalleryImage(args)

    expect(removedPaths()).toEqual(expect.arrayContaining([GALLERY_PATH, THUMB_PATH]))
    expect(lastUpdate()).toMatchObject({ gallery_status: 'failed' })
  })

  // On a reprocess the row already points at these paths, so deleting them
  // would leave it referencing nothing.
  it('leaves already-referenced objects alone on a reprocess', async () => {
    h.updateResult = { data: null, error: new Error('update rejected') }
    await reprocessGalleryImage({
      ...args,
      previousGalleryPath: GALLERY_PATH,
      previousThumbPath: THUMB_PATH,
    })

    expect(removedPaths()).toEqual([])
  })

  it('cleans up both objects when the photo was deleted mid-run', async () => {
    h.updateResult = { data: [], error: null }
    await processGalleryImage(args)

    expect(removedPaths()).toEqual(expect.arrayContaining([GALLERY_PATH, THUMB_PATH]))
  })
})

describe('changing thumbnail format', () => {
  // The extension follows the browser, so reprocessing elsewhere can land on a
  // different path and strand the old object.
  it('deletes the superseded thumbnail after the row points at the new one', async () => {
    h.makeThumbnail.mockResolvedValue(blob('image/png'))
    await reprocessGalleryImage({
      ...args,
      previousGalleryPath: GALLERY_PATH,
      previousThumbPath: THUMB_PATH,
    })

    expect(lastUpdate().storage_path_thumb).toBe(`${USER}/${PATCH}/${PHOTO}-thumb.png`)
    expect(removedPaths()).toEqual([THUMB_PATH])
  })
})
