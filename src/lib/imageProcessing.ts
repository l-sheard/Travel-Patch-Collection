// Generic canvas image processing, independent of where an image came from.
// Kept apart from cloudflareBackgroundRemoval.ts so that module stays about
// talking to the Worker, and this one stays about pixels.

// High threshold: matting models leave a soft, semi-transparent feather at
// edges (and sometimes a faint shadow) — counting those as "content" for the
// crop makes the box much bigger than the visually solid subject. Only count
// strongly-opaque pixels.
const ALPHA_THRESHOLD = 200
const CROP_PADDING = 12

/** Dashboard cards render at ~163 CSS px on a narrow phone and ~224 CSS px on
 * a wide desktop grid, so 512 covers the worst case (163 x 3 device pixels). */
export const THUMBNAIL_SIZE = 512
const THUMBNAIL_QUALITY = 0.8

async function loadImage(blob: Blob): Promise<{ img: HTMLImageElement; release: () => void }> {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
  return { img, release: () => URL.revokeObjectURL(url) }
}

/** Crops to the tight bounding box of the patch, then pads that out to a
 * square (transparent margins on the shorter axis, content centered) so it
 * fills a square gallery tile edge-to-edge instead of leaving empty space
 * on two sides. */
export async function cropAndSquareToContent(blob: Blob): Promise<Blob> {
  const { img, release } = await loadImage(blob)
  try {
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
    release()
  }
}

/** Downscales an already-processed gallery image to a small square for the
 * dashboard cards, preserving transparency.
 *
 * WebP is requested, but canvas silently falls back to PNG where it can't
 * encode WebP, so callers must read the returned blob's `type` rather than
 * assume — the stored file extension and content type come from that. */
export async function makeThumbnail(blob: Blob, size = THUMBNAIL_SIZE): Promise<Blob> {
  const { img, release } = await loadImage(blob)
  try {
    const longestEdge = Math.max(img.naturalWidth, img.naturalHeight)
    if (longestEdge === 0) throw new Error('Image has no dimensions')

    // Never upscale: a source smaller than the target would only get heavier.
    const target = Math.min(size, longestEdge)
    const scale = target / longestEdge
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = target
    canvas.height = target
    const ctx = canvas.getContext('2d')!
    // Centered on a transparent square; the gallery image is already square, so
    // this normally fills the canvas exactly.
    ctx.drawImage(img, Math.round((target - width) / 2), Math.round((target - height) / 2), width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to export thumbnail'))),
        'image/webp',
        THUMBNAIL_QUALITY,
      )
    })
  } finally {
    release()
  }
}

/** File extension matching what the browser actually encoded. */
export function imageExtensionFor(blob: Blob): string {
  return blob.type === 'image/webp' ? 'webp' : 'png'
}
