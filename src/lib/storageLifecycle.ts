// Storage and Postgres can't share a transaction, so these two helpers give
// every call site the same ordering and the same failure semantics:
//
//   Postgres is the source of truth. An object counts as part of the app only
//   while a row references it. Never leave a row pointing at an object that
//   doesn't exist — an unreferenced object is acceptable, because it can be
//   cleaned up later (see the reconciliation query in supabase/schema.sql).

import { supabase } from './supabaseClient'
import type { StorageBucket } from './storagePaths'

export type StorageTarget = { bucket: StorageBucket; path: string }

/** Uploads a file, then writes the database row that references it.
 *
 * The row is written last, so until it exists the object is merely
 * unreferenced. If the row write fails, the just-uploaded object is removed on
 * a best-effort basis and the original error is rethrown — the caller sees why
 * the operation failed, not whatever happened during cleanup. */
export async function uploadThenRecord<T>({
  bucket,
  path,
  file,
  record,
}: {
  bucket: StorageBucket
  path: string
  file: File | Blob
  record: () => Promise<T>
}): Promise<T> {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type || undefined })
  if (uploadError) throw uploadError

  try {
    return await record()
  } catch (err) {
    await removeStorageObjects([{ bucket, path }])
    throw err
  }
}

/** Deletes storage objects that nothing references any more.
 *
 * Only ever called once the authoritative database write has happened, so a
 * failure here leaves an orphan rather than a broken reference, and nothing is
 * rolled back. Never throws: the database state is already correct, and an
 * object that has already gone is the desired end state anyway, which is what
 * makes this safe to call again. */
export async function removeStorageObjects(targets: StorageTarget[]): Promise<void> {
  const pathsByBucket = new Map<StorageBucket, string[]>()
  for (const { bucket, path } of targets) {
    if (!path) continue
    const paths = pathsByBucket.get(bucket)
    if (paths) paths.push(path)
    else pathsByBucket.set(bucket, [path])
  }

  await Promise.all(
    Array.from(pathsByBucket, async ([bucket, paths]) => {
      try {
        const { error } = await supabase.storage.from(bucket).remove(paths)
        if (error) throw error
      } catch (err) {
        // Swallowed deliberately: callers have already committed the database
        // change this cleanup follows, and must not be made to fail (or to
        // roll anything back) because a file couldn't be removed.
        console.error(`Storage cleanup failed in ${bucket} — left orphaned`, paths, err)
      }
    }),
  )
}
