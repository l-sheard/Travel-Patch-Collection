import { supabase } from './supabaseClient'

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
  return response.blob()
}
