import { describe, it, expect } from 'vitest'
import { validateImageFile, MAX_IMAGE_BYTES } from './broadcast-image'

describe('validateImageFile', () => {
  it('accepts a small PNG', () => {
    expect(validateImageFile({ type: 'image/png', size: 1024 })).toBeNull()
  })

  it('accepts a JPEG and WebP', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1024 })).toBeNull()
    expect(validateImageFile({ type: 'image/webp', size: 1024 })).toBeNull()
  })

  it('rejects a non-image type', () => {
    expect(validateImageFile({ type: 'application/pdf', size: 1024 })).toBe(
      'Image must be PNG, JPG, or WebP',
    )
  })

  it('rejects a file over 2 MB', () => {
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toBe(
      'Image must be under 2 MB',
    )
  })
})
