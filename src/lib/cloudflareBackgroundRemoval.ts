import { supabase } from './supabaseClient'
import { cropAndSquareToContent } from './backgroundRemoval'

// Optional: only used when a deployed Worker URL is configured (see worker/).
// Falls back to on-device removal (backgroundRemoval.ts) otherwise/on failure.
const WORKER_URL = import.meta.env.VITE_BG_REMOVAL_WORKER_URL as string | undefined

export const isCloudflareBackgroundRemovalEnabled = Boolean(WORKER_URL)

const SIGNED_URL_TTL_SECONDS = 300

/** Runs background removal via the Cloudflare Worker on an already-uploaded
 * original photo. Throws on any failure — callers should catch and fall
 * back to removePatchBackground() from backgroundRemoval.ts. */
export async function removeBackgroundViaCloudflare(storagePathOriginal: string): Promise<Blob> {
  if (!WORKER_URL) throw new Error('Cloudflare background removal is not configured')

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

  if (!response.ok) {
    throw new Error(`Cloudflare background removal failed (${response.status})`)
  }
  // The Worker returns the segmented image at full frame size — crop to the
  // patch's content and square it, same post-processing as the on-device
  // path, so gallery tiles look consistent regardless of which backend ran.
  return cropAndSquareToContent(await response.blob())
}

/** Same as removeBackgroundViaCloudflare, but for a photo that isn't
 * otherwise persisted (e.g. a scan-to-match snapshot) — the Worker needs a
 * fetchable URL, so this uploads to a scratch path, processes it, then
 * removes the scratch upload regardless of outcome. */
export async function removeBackgroundViaCloudflareForFile(file: File | Blob, userId: string): Promise<Blob> {
  if (!WORKER_URL) throw new Error('Cloudflare background removal is not configured')

  const ext = file instanceof File ? (file.name.split('.').pop()?.toLowerCase() ?? 'jpg') : 'jpg'
  const tempPath = `${userId}/_scan-temp/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('patch-originals')
    .upload(tempPath, file, { contentType: file.type || 'image/jpeg' })
  if (uploadError) throw uploadError

  try {
    return await removeBackgroundViaCloudflare(tempPath)
  } finally {
    void supabase.storage.from('patch-originals').remove([tempPath])
  }
}
