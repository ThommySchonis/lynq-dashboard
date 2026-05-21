/**
 * Escape SQL LIKE wildcard characters in user input.
 * Use before interpolating into Supabase `.ilike()` patterns.
 *
 * Escapes: % (any chars) → \%, _ (single char) → \_
 */
export function sanitizeLikeInput(raw: string): string {
  return raw.replace(/[%_]/g, (ch) => `\\${ch}`)
}
