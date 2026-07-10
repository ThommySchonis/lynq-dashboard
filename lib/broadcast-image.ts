export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

/**
 * Validate a user-selected cover image by MIME type and byte size.
 * Returns an error message when invalid, or null when valid.
 */
export function validateImageFile(input: { type: string; size: number }): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(input.type as AllowedImageType)) {
    return 'Image must be PNG, JPG, or WebP'
  }
  if (input.size > MAX_IMAGE_BYTES) {
    return 'Image must be under 2 MB'
  }
  return null
}
