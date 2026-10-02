import { supabase } from './supabaseClient'
import { fileExtension, scanTempPath } from './storagePaths'
import { removeStorageObjects } from './storageLifecycle'

// Background removal runs server-side, via our Cloudflare Worker (see worker/)
// calling Cloudflare Images. There is no on-device fallback: a second
// implementation meant shipping ~23MB of ONNX runtime for a path that, with the
// Worker configured, was never warmed and took 50s+ on the rare occasions it
// ran. Without the Worker configured, background removal simply fails loudly
// rather than silently producing un-isolated images.
const WORKER_URL = import.meta.env.VITE_BG_REMOVAL_WORKER_URL as string | undefined

const SIGNED_URL_TTL_SECONDS = 300

// High threshold: matting models leave a soft, semi-transparent feather at
// edges (and sometimes a faint shadow) — counting those as "content" for the
// crop makes the box much bigger than the visually solid subject. Only count
// strongly-opaque pixels.
const ALPHA_THRESHOLD = 200
const CROP_PADDING = 12

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

/** Crops to the tight bounding box of the patch, then pads that out to a
 * square (transparent margins on the shorter axis, content centered) so it
 * fills a square gallery tile edge-to-edge instead of leaving empty space
 * on two sides. */
export async function cropAndSquareToContent(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image for cropping'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let minX = canvas.width
    let minY = canvas.height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3]
        if (alpha > ALPHA_THRESHOLD) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (maxX < minX || maxY < minY) return blob // fully transparent, nothing to crop

    minX = Math.max(0, minX - CROP_PADDING)
    minY = Math.max(0, minY - CROP_PADDING)
    maxX = Math.min(canvas.width - 1, maxX + CROP_PADDING)
    maxY = Math.min(canvas.height - 1, maxY + CROP_PADDING)

    const cropWidth = maxX - minX + 1
    const cropHeight = maxY - minY + 1
    const squareSize = Math.max(cropWidth, cropHeight)
    const offsetX = Math.round((squareSize - cropWidth) / 2)
    const offsetY = Math.round((squareSize - cropHeight) / 2)

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = squareSize
    cropCanvas.height = squareSize
    cropCanvas
      .getContext('2d')!
      .drawImage(canvas, minX, minY, cropWidth, cropHeight, offsetX, offsetY, cropWidth, cropHeight)

    return await new Promise<Blob>((resolve, reject) => {
      cropCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to export cropped image'))), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
