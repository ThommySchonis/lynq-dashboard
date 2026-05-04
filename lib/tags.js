/**
 * Shared helpers for the tags system (Phase 1).
 *
 * COLORS — must match the CHECK constraint on public.tags.color
 */
export const TAG_COLORS = [
  'slate', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
  'teal',  'cyan', 'sky',    'blue',  'indigo', 'violet', 'purple', 'fuchsia',
  'pink',  'rose',
]

// Tailwind-ish HEX values used in the UI (light bg + readable text).
// Source-of-truth for chip rendering across both Manage page and editor.
export const TAG_PALETTE = {
  slate:   { bg: '#F1F5F9', text: '#475569', dot: '#64748B' },
  red:     { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' },
  orange:  { bg: '#FFEDD5', text: '#C2410C', dot: '#F97316' },
  amber:   { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
  yellow:  { bg: '#FEF9C3', text: '#A16207', dot: '#EAB308' },
  lime:    { bg: '#ECFCCB', text: '#4D7C0F', dot: '#84CC16' },
  green:   { bg: '#DCFCE7', text: '#15803D', dot: '#22C55E' },
  emerald: { bg: '#D1FAE5', text: '#047857', dot: '#10B981' },
  teal:    { bg: '#CCFBF1', text: '#0F766E', dot: '#14B8A6' },
  cyan:    { bg: '#CFFAFE', text: '#0E7490', dot: '#06B6D4' },
  sky:     { bg: '#E0F2FE', text: '#0369A1', dot: '#0EA5E9' },
  blue:    { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  indigo:  { bg: '#E0E7FF', text: '#3730A3', dot: '#6366F1' },
  violet:  { bg: '#EDE9FE', text: '#5B21B6', dot: '#8B5CF6' },
  purple:  { bg: '#F3E8FF', text: '#6B21A8', dot: '#A855F7' },
  fuchsia: { bg: '#FAE8FF', text: '#86198F', dot: '#D946EF' },
  pink:    { bg: '#FCE7F3', text: '#BE185D', dot: '#EC4899' },
  rose:    { bg: '#FFE4E6', text: '#BE123C', dot: '#F43F5E' },
}

export function paletteFor(color) {
  return TAG_PALETTE[color] || TAG_PALETTE.slate
}

export function sanitizeTagName(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, 40)
}

/**
 * Ensures a list of tag names exists for the workspace, returning a
 * Map of (lowercased name) → tag id. Missing tags are inserted with
 * 'slate' color. Used by macro write endpoints + the AI generator.
 *
 * @returns {Promise<Map<string, string>>}  lower(name) → id
 */
export async function ensureTagsByName(supabaseAdmin, workspaceId, names, createdBy) {
  if (!Array.isArray(names) || names.length === 0) return new Map()
  const cleaned = names
    .map(sanitizeTagName)
    .filter(Boolean)
  if (cleaned.length === 0) return new Map()

  // Pull all workspace tags once; small per-workspace list so a full fetch
  // is cheaper than building an OR-filter for every call.
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('tags')
    .select('id, name')
    .eq('workspace_id', workspaceId)

  if (lookupError) {
    console.error('[tags] lookup for ensureTagsByName failed:', lookupError.message)
    throw lookupError
  }

  const byLower = new Map()
  for (const t of existing || []) byLower.set(t.name.toLowerCase(), t.id)

  // Determine which need creation, preserving original casing of the first
  // occurrence we see (mirrors how a typed tag would persist).
  const toCreateMap = new Map()  // lower → original
  for (const name of cleaned) {
    const lc = name.toLowerCase()
    if (!byLower.has(lc) && !toCreateMap.has(lc)) toCreateMap.set(lc, name)
  }

  if (toCreateMap.size > 0) {
    const rows = Array.from(toCreateMap.values()).map(name => ({
      workspace_id: workspaceId,
      name,
      color:        'slate',
      created_by:   createdBy ?? null,
    }))
    const { data: created, error: insertError } = await supabaseAdmin
      .from('tags')
      .insert(rows)
      .select('id, name')

    if (insertError) {
      console.error('[tags] bulk-insert failed in ensureTagsByName:', insertError.message)
      throw insertError
    }
    for (const t of created || []) byLower.set(t.name.toLowerCase(), t.id)
  }

  return byLower
}

/**
 * Replace the macro_tags rows for a given macro to match the supplied
 * list of tag IDs. Idempotent. Caller is responsible for permission
 * checks + workspace scoping (verifies tag IDs belong to the workspace
 * before calling this — this helper trusts its inputs).
 */
export async function syncMacroTags(supabaseAdmin, macroId, tagIds) {
  // Replace strategy: delete existing, insert new. Simple + correct for
  // small N (<= ~25 tags per macro). For large N we'd diff instead.
  const { error: delError } = await supabaseAdmin
    .from('macro_tags')
    .delete()
    .eq('macro_id', macroId)

  if (delError) {
    console.error('[tags] macro_tags delete failed:', delError.message)
    throw delError
  }

  if (!tagIds || tagIds.length === 0) return

  const rows = tagIds.map(tag_id => ({ macro_id: macroId, tag_id }))
  const { error: insError } = await supabaseAdmin
    .from('macro_tags')
    .insert(rows)

  if (insError) {
    console.error('[tags] macro_tags insert failed:', insError.message)
    throw insError
  }
}
