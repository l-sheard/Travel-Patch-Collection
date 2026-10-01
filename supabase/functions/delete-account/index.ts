// Deletes the calling user's account and everything owned by them.
//
// Requires SUPABASE_SERVICE_ROLE_KEY, which must never be exposed
// client-side — that's why this runs as an Edge Function rather than a
// direct client call. SUPABASE_URL and SUPABASE_ANON_KEY are provided
// automatically by the Supabase platform for every Edge Function.
//
// Storage can't take part in a Postgres transaction, so this is NOT atomic.
// What it does instead is keep the single irreversible step indivisible, and
// make every step safe to repeat:
//
//   1. list the user's storage objects                 (read-only)
//   2. delete the auth user                            (one atomic operation;
//      every app table cascades from auth.users, so this removes all rows)
//   3. delete the listed objects                       (best-effort)
//
// Anything that fails at step 1 or 2 has destroyed nothing, so the caller can
// simply try again. The only step that runs after something irreversible is
// the storage cleanup, and the worst it can leave behind is files that no row
// references — never a row pointing at a file that's gone.
//
// Remaining failure mode, deliberately accepted: if step 3 fails the account
// is already gone, so the user can't retry it, and the leftover objects have
// to be reclaimed with the reconciliation query in supabase/schema.sql. The
// leftover paths are logged here so they can be found. A fully robust version
// would persist a deletion request and let a scheduled job retry until every
// bucket is clear — that needs a state table plus cron, which is out of
// proportion for this app.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const STORAGE_BUCKETS = ['patch-originals', 'patch-gallery', 'patch-dishes']
const ALLOWED_ORIGINS = ['https://mytravelpatches.com', 'http://localhost:5173']
const REMOVE_CHUNK_SIZE = 100

function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

// storage.list() only returns one level — patch files live nested under
// `${userId}/${patchId}/...`, so recurse to find everything. Read-only: this
// runs before anything is deleted, so the list is captured while the rows that
// reference it still exist.
async function listAllUnderPrefix(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const { data: entries } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  if (!entries?.length) return []

  const paths: string[] = []
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`
    if (entry.id === null) {
      paths.push(...(await listAllUnderPrefix(admin, bucket, path)))
    } else {
      paths.push(path)
    }
  }
  return paths
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Identify the caller using their own token — never trust a userId from
  // the request body, only ever delete the account of whoever is asking.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Capture what will need cleaning up. Nothing is destroyed yet, so a
  //    failure here is a clean no-op the caller can retry.
  const pathsByBucket: Record<string, string[]> = {}
  try {
    for (const bucket of STORAGE_BUCKETS) {
      pathsByBucket[bucket] = await listAllUnderPrefix(admin, bucket, user.id)
    }
  } catch (err) {
    console.error('Failed to list storage before account deletion', err)
    return new Response(JSON.stringify({ error: 'Could not read your files — nothing was deleted, please try again.' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // 2. The one irreversible step, and it's a single atomic operation:
  //    deleting the auth user cascades every `on delete cascade` row in the
  //    public schema (patches, trips, patch_photos, patch_dishes).
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    // Nothing has been destroyed: rows, files and account are all intact.
    // (If this ever fails with a foreign-key error naming storage.objects,
    // this project's storage schema still has the legacy owner -> auth.users
    // reference; the fix is to delete the app's rows and the files first, then
    // the user.)
    console.error('Failed to delete auth user; nothing was deleted', deleteError)
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // 3. The rows are gone, so every one of these objects is now unreferenced.
  //    Failures here can only leave orphans, never a broken reference, so they
  //    don't fail the request — the account really has been deleted.
  let storageCleanup: 'complete' | 'partial' = 'complete'
  for (const bucket of STORAGE_BUCKETS) {
    const paths = pathsByBucket[bucket] ?? []
    for (let i = 0; i < paths.length; i += REMOVE_CHUNK_SIZE) {
      const chunk = paths.slice(i, i + REMOVE_CHUNK_SIZE)
      try {
        const { error } = await admin.storage.from(bucket).remove(chunk)
        if (error) throw error
      } catch (err) {
        storageCleanup = 'partial'
        console.error(`Orphaned after account deletion in ${bucket}`, chunk, err)
      }
    }
  }

  return new Response(JSON.stringify({ success: true, storage_cleanup: storageCleanup }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
