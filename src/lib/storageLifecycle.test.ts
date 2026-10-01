import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeStorageObjects, uploadThenRecord } from './storageLifecycle'

const storage = vi.hoisted(() => {
  type BucketApi = {
    upload: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
  }
  const buckets = new Map<string, BucketApi>()

  function bucket(name: string): BucketApi {
    let api = buckets.get(name)
    if (!api) {
      api = {
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }
      buckets.set(name, api)
    }
    return api
  }

  return { bucket, reset: () => buckets.clear() }
})

vi.mock('./supabaseClient', () => ({
  supabase: { storage: { from: (name: string) => storage.bucket(name) } },
}))

const file = new File([new Uint8Array(1)], 'patch.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  storage.reset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('uploadThenRecord', () => {
  it('uploads before writing the row, and returns what the row write returned', async () => {
    const order: string[] = []
    const originals = storage.bucket('patch-originals')
    originals.upload.mockImplementation(async () => {
      order.push('upload')
      return { error: null }
    })

    const result = await uploadThenRecord({
      bucket: 'patch-originals',
      path: 'u/p/photo.jpg',
      file,
      record: async () => {
        order.push('record')
        return { id: 'photo' }
      },
    })

    expect(order).toEqual(['upload', 'record'])
    expect(result).toEqual({ id: 'photo' })
    expect(originals.remove).not.toHaveBeenCalled()
  })

  it('never writes the row if the upload failed', async () => {
    const originals = storage.bucket('patch-originals')
    originals.upload.mockResolvedValue({ error: new Error('upload exploded') })
    const record = vi.fn()

    await expect(
      uploadThenRecord({ bucket: 'patch-originals', path: 'u/p/photo.jpg', file, record }),
    ).rejects.toThrow('upload exploded')

    expect(record).not.toHaveBeenCalled()
    expect(originals.remove).not.toHaveBeenCalled()
  })

  // The invariant: a failed row write must not leave the object behind as the
  // app's only trace of the operation, and must surface its own error.
  it('removes the uploaded object and rethrows the original error if the row write fails', async () => {
    const originals = storage.bucket('patch-originals')

    await expect(
      uploadThenRecord({
        bucket: 'patch-originals',
        path: 'u/p/photo.jpg',
        file,
        record: async () => {
          throw new Error('insert rejected by RLS')
        },
      }),
    ).rejects.toThrow('insert rejected by RLS')

    expect(originals.remove).toHaveBeenCalledWith(['u/p/photo.jpg'])
  })

  it('still reports the original error when the compensating delete also fails', async () => {
    const originals = storage.bucket('patch-originals')
    originals.remove.mockRejectedValue(new Error('cleanup also failed'))

    await expect(
      uploadThenRecord({
        bucket: 'patch-originals',
        path: 'u/p/photo.jpg',
        file,
        record: async () => {
          throw new Error('insert rejected by RLS')
        },
      }),
    ).rejects.toThrow('insert rejected by RLS')
  })
})

describe('removeStorageObjects', () => {
  it('sends one request per bucket', async () => {
    await removeStorageObjects([
      { bucket: 'patch-originals', path: 'u/p/a.jpg' },
      { bucket: 'patch-gallery', path: 'u/p/a-gallery.png' },
      { bucket: 'patch-originals', path: 'u/p/b.jpg' },
    ])

    expect(storage.bucket('patch-originals').remove).toHaveBeenCalledTimes(1)
    expect(storage.bucket('patch-originals').remove).toHaveBeenCalledWith(['u/p/a.jpg', 'u/p/b.jpg'])
    expect(storage.bucket('patch-gallery').remove).toHaveBeenCalledWith(['u/p/a-gallery.png'])
  })

  it('does nothing when there is nothing to remove', async () => {
    await removeStorageObjects([])
    expect(storage.bucket('patch-originals').remove).not.toHaveBeenCalled()
  })

  // Callers run this after the authoritative database write, so it must not be
  // able to fail them or make them roll anything back.
  it('never throws, whether storage returns an error or rejects', async () => {
    storage.bucket('patch-originals').remove.mockResolvedValue({ error: new Error('gone wrong') })
    storage.bucket('patch-gallery').remove.mockRejectedValue(new Error('network down'))

    await expect(
      removeStorageObjects([
        { bucket: 'patch-originals', path: 'u/p/a.jpg' },
        { bucket: 'patch-gallery', path: 'u/p/a-gallery.png' },
      ]),
    ).resolves.toBeUndefined()
  })
})
