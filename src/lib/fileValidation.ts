// Keep in sync with the storage bucket `file_size_limit` in supabase/schema.sql.
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is over the 15MB limit.`
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return `${file.name} isn't a supported image type.`
  }
  return null
}
