import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export type PhotoBucket = 'patch-originals' | 'patch-gallery' | 'patch-dishes'

const SIGNED_URL_EXPIRY = 3600
const BATCH_WINDOW_MS = 10

type PendingEntry = { resolve: (url: string) => void; reject: (err: Error) => void }

// A list of N patch cards was firing N separate createSignedUrl() network
// requests (one per usePhotoUrl() call). This coalesces every call that
// lands within the same short window into one createSignedUrls() request
// per bucket instead.
const pendingByBucket = new Map<PhotoBucket, Map<string, PendingEntry[]>>()
const flushScheduled = new Set<PhotoBucket>()

function scheduleFlush(bucket: PhotoBucket) {
  if (flushScheduled.has(bucket)) return
  flushScheduled.add(bucket)
  setTimeout(() => {
    flushScheduled.delete(bucket)
    void flushBucket(bucket)
  }, BATCH_WINDOW_MS)
}

async function flushBucket(bucket: PhotoBucket) {
  const pending = pendingByBucket.get(bucket)
  if (!pending || pending.size === 0) return
  pendingByBucket.delete(bucket)

  const paths = Array.from(pending.keys())
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_EXPIRY)

  if (error || !data) {
    const err = error ?? new Error('Failed to create signed URLs')
    for (const waiters of pending.values()) {
      for (const w of waiters) w.reject(err)
    }
    return
  }

  for (const result of data) {
    const waiters = result.path ? pending.get(result.path) : undefined
    if (!waiters) continue
    for (const w of waiters) {
      if (result.signedUrl) w.resolve(result.signedUrl)
      else w.reject(new Error(result.error ?? 'Failed to create signed URL'))
    }
  }
}

function batchedCreateSignedUrl(bucket: PhotoBucket, path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let byPath = pendingByBucket.get(bucket)
    if (!byPath) {
      byPath = new Map()
      pendingByBucket.set(bucket, byPath)
    }
    const waiters = byPath.get(path)
    if (waiters) waiters.push({ resolve, reject })
    else byPath.set(path, [{ resolve, reject }])

    scheduleFlush(bucket)
  })
}

export function usePhotoUrl(bucket: PhotoBucket, path: string | null | undefined) {
  return useQuery({
    queryKey: ['photo-url', bucket, path],
    queryFn: () => batchedCreateSignedUrl(bucket, path as string),
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
  })
}
