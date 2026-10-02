import { describe, expect, it } from 'vitest'
import {
  dishPhotoPath,
  fileExtension,
  galleryPhotoPath,
  originalPhotoPath,
  scanTempPath,
  thumbPhotoPath,
} from './storagePaths'

const USER = '11111111-1111-1111-1111-111111111111'
const PATCH = '22222222-2222-2222-2222-222222222222'
const PHOTO = '33333333-3333-3333-3333-333333333333'

function makeFile(name: string): File {
  return new File([new Uint8Array(1)], name, { type: 'image/jpeg' })
}

describe('fileExtension', () => {
  it('lowercases the extension', () => {
    expect(fileExtension(makeFile('patch.JPG'))).toBe('jpg')
  })

  it('takes the last extension', () => {
    expect(fileExtension(makeFile('archive.tar.gz'))).toBe('gz')
  })

  it('falls back when there is no extension', () => {
    expect(fileExtension(makeFile('no-extension'))).toBe('jpg')
    expect(fileExtension(makeFile('trailing.'))).toBe('jpg')
    expect(fileExtension(makeFile('.hidden'))).toBe('jpg')
  })

  it('falls back for a Blob, which has no name', () => {
    expect(fileExtension(new Blob([new Uint8Array(1)], { type: 'image/png' }))).toBe('jpg')
  })

  it('falls back for implausible extensions', () => {
    expect(fileExtension(makeFile('weird.photo-of-a-patch'))).toBe('jpg')
  })
})

describe('storage paths', () => {
  it('scopes every path to the user, which is what the storage policies check', () => {
    expect(originalPhotoPath(USER, PATCH, PHOTO, 'jpg').startsWith(`${USER}/`)).toBe(true)
    expect(galleryPhotoPath(USER, PATCH, PHOTO).startsWith(`${USER}/`)).toBe(true)
    expect(thumbPhotoPath(USER, PATCH, PHOTO, 'webp').startsWith(`${USER}/`)).toBe(true)
    expect(dishPhotoPath(USER, PATCH, PHOTO, 'jpg').startsWith(`${USER}/`)).toBe(true)
    expect(scanTempPath(USER, PHOTO, 'jpg').startsWith(`${USER}/`)).toBe(true)
  })

  it('keeps the thumbnail distinct from the gallery image it was made from', () => {
    expect(thumbPhotoPath(USER, PATCH, PHOTO, 'webp')).toBe(`${USER}/${PATCH}/${PHOTO}-thumb.webp`)
    expect(thumbPhotoPath(USER, PATCH, PHOTO, 'webp')).not.toBe(galleryPhotoPath(USER, PATCH, PHOTO))
  })

  // The extension follows whatever the browser actually encoded, so a PNG
  // fallback must not be stored under a .webp name.
  it('takes the thumbnail extension from its caller', () => {
    expect(thumbPhotoPath(USER, PATCH, PHOTO, 'png')).toBe(`${USER}/${PATCH}/${PHOTO}-thumb.png`)
  })

  it('groups a patch\'s objects under the patch, so deleting one is a prefix sweep', () => {
    expect(originalPhotoPath(USER, PATCH, PHOTO, 'jpg')).toBe(`${USER}/${PATCH}/${PHOTO}.jpg`)
    expect(galleryPhotoPath(USER, PATCH, PHOTO)).toBe(`${USER}/${PATCH}/${PHOTO}-gallery.png`)
    expect(dishPhotoPath(USER, PATCH, PHOTO, 'png')).toBe(`${USER}/${PATCH}/${PHOTO}.png`)
  })

  // The retry-safety property the whole lifecycle leans on: re-running an
  // upload for the same photo overwrites one object instead of accumulating.
  it('is deterministic for the same ids', () => {
    expect(galleryPhotoPath(USER, PATCH, PHOTO)).toBe(galleryPhotoPath(USER, PATCH, PHOTO))
    expect(originalPhotoPath(USER, PATCH, PHOTO, 'jpg')).toBe(originalPhotoPath(USER, PATCH, PHOTO, 'jpg'))
  })
})
