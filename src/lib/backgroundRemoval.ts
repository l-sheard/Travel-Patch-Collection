import { removeBackground } from '@imgly/background-removal'

export async function removePatchBackground(image: File | Blob): Promise<Blob> {
  return removeBackground(image, {
    output: { format: 'image/png', quality: 0.9 },
  })
}
