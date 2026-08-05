import type { MobileNet } from '@tensorflow-models/mobilenet'

let modelPromise: Promise<MobileNet> | null = null

// Dynamically imported so TensorFlow.js/MobileNet (large) only load when a
// scan or photo-index actually runs, not on every page of the app.
function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import('@tensorflow/tfjs')
      const mobilenet = await import('@tensorflow-models/mobilenet')
      return mobilenet.load({ version: 1, alpha: 1.0 })
    })()
  }
  return modelPromise
}

/** Kicks off the (memoized) model download/compile early — e.g. as soon as
 * the scan page mounts — so it's likely already warm by the time a photo's
 * actually picked, instead of only starting once analysis is requested. */
export function preloadImageMatchModel() {
  void loadModel().catch(() => {
    // Swallow — analyzePatchPhoto will retry and surface any real failure there.
  })
}

async function loadImageElement(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function drawToCanvas(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, size, size)
  return canvas
}

function computeHashFromCanvas(canvas: HTMLCanvasElement): bigint {
  const size = canvas.width
  const ctx = canvas.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, size, size)

  const gray: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    gray.push((data[i] + data[i + 1] + data[i + 2]) / 3)
  }

  let hash = 0n
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - 1; col++) {
      const left = gray[row * size + col]
      const right = gray[row * size + col + 1]
      hash = (hash << 1n) | (left > right ? 1n : 0n)
    }
  }
  return hash
}

export type PhotoAnalysis = {
  embedding: number[]
  phash: bigint
}

/** Computes a MobileNet embedding + a perceptual hash for a patch photo, entirely client-side. */
export async function analyzePatchPhoto(file: File | Blob): Promise<PhotoAnalysis> {
  const img = await loadImageElement(file)
  const model = await loadModel()

  const embeddingCanvas = drawToCanvas(img, 224)
  const tensor = model.infer(embeddingCanvas, true)
  const embeddingData = await tensor.data()
  tensor.dispose()

  const hashCanvas = drawToCanvas(img, 8)
  const phash = computeHashFromCanvas(hashCanvas)

  return { embedding: Array.from(embeddingData), phash }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b
  let count = 0
  while (x > 0n) {
    count += Number(x & 1n)
    x >>= 1n
  }
  return count
}

/** pgvector columns can round-trip through PostgREST as a JSON string rather than an array. */
export function parseEmbedding(value: unknown): number[] | null {
  if (!value) return null
  if (Array.isArray(value)) return value as number[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as number[]) : null
    } catch {
      return null
    }
  }
  return null
}
