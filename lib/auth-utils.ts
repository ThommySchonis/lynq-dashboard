/**
 * Validate a `?redirect=` query param so we only ever navigate to a same-origin
 * path, never an external URL (prevents open-redirect). Returns `/home` as the
 * safe default. Client-only (reads `window.location`).
 */
export function getSafeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/home'
  }
  try {
    const url = new URL(raw, window.location.origin)
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/home'
  } catch {
    return '/home'
  }
}
