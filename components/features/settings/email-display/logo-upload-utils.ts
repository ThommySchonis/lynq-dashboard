// Shared logo-upload validation for the email-display surface — used by both
// branding-card.tsx (redesigned) and logo-upload.tsx (account overrides).

export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
export const MAX_LOGO_SIZE = 2 * 1024 * 1024 // 2 MB

export function isValidLogoFile(file: File): boolean {
  return ALLOWED_LOGO_TYPES.includes(file.type) && file.size <= MAX_LOGO_SIZE
}
