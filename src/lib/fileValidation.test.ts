import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES, validateImageFile } from './fileValidation'

function makeFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)], { type })
  return new File([blob], name, { type })
}

describe('validateImageFile', () => {
  it('accepts a normal-sized jpeg', () => {
    const file = makeFile('patch.jpg', 'image/jpeg', 1024)
    expect(validateImageFile(file)).toBeNull()
  })

  it('rejects files over the size limit', () => {
    const file = makeFile('huge.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1)
    expect(validateImageFile(file)).toMatch(/15MB/)
  })

  it('rejects unsupported file types', () => {
    const file = makeFile('doc.pdf', 'application/pdf', 1024)
    expect(validateImageFile(file)).toMatch(/supported image type/)
  })
})
