import { removeBackground } from '@imgly/background-removal'

// High threshold: matting models leave a soft, semi-transparent feather at
// edges (and sometimes a faint shadow) — counting those as "content" for the
// crop makes the box much bigger than the visually solid subject. Only count
// strongly-opaque pixels.
const ALPHA_THRESHOLD = 200
const CROP_PADDING = 12

// Phone photos are often far larger than a gallery "sticker" ever needs to
// be. Downscaling before inference cuts decode/mask-composite/encode time
// substantially, since that cost scales with pixel count, not just model size.
const MAX_INPUT_DIMENSION = 1600

export async function removePatchBackground(image: File | Blob): Promise<Blob> {
  const resized = await resizeIfLarger(image, MAX_INPUT_DIMENSION)
  const result = await removeBackground(resized, {
    // Quantized model: meaningfully faster than the default fp16 model, at
    // an edge-quality cost that's not visible once cropped to thumbnail size.
    model: 'isnet_quint8',
    // Safe to request unconditionally — the library feature-detects WebGPU
    // support and falls back to (already multi-threaded) WASM otherwise.
    device: 'gpu',
    output: { format: 'image/png', quality: 0.9 },
  })
  return cropToContent(result)
}

/** Downscales to `maxDimension` on the long edge; returns the original unchanged if already smaller. */
async function resizeIfLarger(image: File | Blob, maxDimension: number): Promise<File | Blob> {
  const url = URL.createObjectURL(image)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image for resizing'))
      img.src = url
    })

    const scale = maxDimension / Math.max(img.naturalWidth, img.naturalHeight)
    if (scale >= 1) return image

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to export resized image'))), 'image/jpeg', 0.9)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** removeBackground() keeps the original canvas size — crop the transparent
 * margins so the patch actually fills its frame in the UI. */
async function cropToContent(blob: Blob): Promise<Blob> {
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

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = cropWidth
    cropCanvas.height = cropHeight
    cropCanvas.getContext('2d')!.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

    return await new Promise<Blob>((resolve, reject) => {
      cropCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to export cropped image'))), 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
