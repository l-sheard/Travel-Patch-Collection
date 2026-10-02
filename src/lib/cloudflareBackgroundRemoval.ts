import { supabase } from './supabaseClient'
import { fileExtension, scanTempPath } from './storagePaths'
import { removeStorageObjects } from './storageLifecycle'
import { cropAndSquareToContent } from './imageProcessing'

// Background removal runs server-side, via our Cloudflare Worker (see worker/)
// calling Cloudflare Images. There is no on-device fallback: a second
// implementation meant shipping ~23MB of ONNX runtime for a path that, with the
// Worker configured, was never warmed and took 50s+ on the rare occasions it
// ran. Without the Worker configured, background removal simply fails loudly
// rather than silently producing un-isolated images.
const WORKER_URL = import.meta.env.VITE_BG_REMOVAL_WORKER_URL as string | undefined

const SIGNED_URL_TTL_SECONDS = 300

/** Runs background removal via the Cloudflare Worker on an already-uploaded
 * original photo. Throws on any failure. */
export async function removeBackgroundViaCloudflare(storagePathOriginal: string): Promise<Blob> {
  if (!WORKER_URL) throw new Error('Background removal is not configured (VITE_BG_REMOVAL_WORKER_URL)')

  const { data: signed, error: signError } = await supabase.storage
    .from('patch-originals')
    .createSignedUrl(storagePathOriginal, SIGNED_URL_TTL_SECONDS)
  if (signError || !signed?.signedUrl) {
    throw signError ?? new Error('Failed to create a signed URL for the original photo')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Not signed in')

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ imageUrl: signed.signedUrl }),
  })

  // The Worker rate-limits per account (see worker/wrangler.jsonc). Worth its
  // own message: the request is fine and retrying later will work, which
  // "failed (429)" doesn't convey.
  if (response.status === 429) {
    throw new Error('Too many photos processed in the last minute. Wait a moment and try again.')
  }
  if (!response.ok) {
    throw new Error(`Background removal failed (${response.status})`)
  }
  // The Worker returns the segmented image at full frame size — crop to the
  // patch's content and square it so gallery tiles are consistent.
  return cropAndSquareToContent(await response.blob())
}

/** Same as removeBackgroundViaCloudflare, but for a photo that isn't
 * otherwise persisted (e.g. a scan-to-match snapshot) — the Worker needs a
 * fetchable URL, so this uploads to a scratch path, processes it, then
 * removes the scratch upload regardless of outcome. */
export async function removeBackgroundViaCloudflareForFile(file: File | Blob, userId: string): Promise<Blob> {
  if (!WORKER_URL) throw new Error('Background removal is not configured (VITE_BG_REMOVAL_WORKER_URL)')

  const tempPath = scanTempPath(userId, crypto.randomUUID(), fileExtension(file))

  const { error: uploadError } = await supabase.storage
    .from('patch-originals')
    .upload(tempPath, file, { contentType: file.type || 'image/jpeg' })
  if (uploadError) throw uploadError

  try {
    return await removeBackgroundViaCloudflare(tempPath)
  } finally {
    // No row ever references this, so it is always safe to delete and never
    // leaves anything dangling if the removal fails.
    void removeStorageObjects([{ bucket: 'patch-originals', path: tempPath }])
  }
}

