// Deletes the calling user's account and everything owned by them.
//
// Requires SUPABASE_SERVICE_ROLE_KEY, which must never be exposed
// client-side — that's why this runs as an Edge Function rather than a
// direct client call. SUPABASE_URL and SUPABASE_ANON_KEY are provided
// automatically by the Supabase platform for every Edge Function.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const STORAGE_BUCKETS = ['patch-originals', 'patch-gallery', 'patch-dishes']
const ALLOWED_ORIGINS = ['https://mytravelpatches.com', 'http://localhost:5173']

function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

// storage.list() only returns one level — patch files live nested under
// `${userId}/${patchId}/...`, so recurse to actually clear everything.
async function deleteAllUnderPrefix(admin: ReturnType<typeof createClient>, bucket: string, prefix: string) {
  const { data: entries } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
  if (!entries?.length) return

  const files: string[] = []
  for (const entry of entries) {
    const path = `${prefix}/${entry.name}`
    if (entry.id === null) {
      await deleteAllUnderPrefix(admin, bucket, path)
    } else {
      files.push(path)
    }
  }
  if (files.length > 0) {
    await admin.storage.from(bucket).remove(files)
  }
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

  for (const bucket of STORAGE_BUCKETS) {
    await deleteAllUnderPrefix(admin, bucket, user.id)
  }

  // Deleting the auth user cascades every `on delete cascade` row in the
  // public schema (patches, trips, patch_photos, patch_dishes).
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
