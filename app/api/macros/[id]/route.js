import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../lib/auth'
import { can } from '../../../../lib/permissions'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { sanitizeMacroInput, relativeTime } from '../../../../lib/macros'
import { ensureTagsByName, syncMacroTags } from '../../../../lib/tags'

// GET /api/macros/[id] — single macro detail
export async function GET(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewMacros(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: macro, error } = await supabaseAdmin
    .from('macros')
    .select(`
      id, name, body, language, tags, usage_count, last_used_at, archived_at, created_at, updated_at, created_by,
      tag_links:macro_tags(tag:tags(id, name, color))
    `)
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[macros GET id] failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'lookup_failed' }, { status: 500 })
  }
  if (!macro) return NextResponse.json({ error: 'Macro not found', code: 'not_found' }, { status: 404 })

  const tagObjects = Array.isArray(macro.tag_links)
    ? macro.tag_links.map(l => l.tag).filter(Boolean)
    : []
  const { tag_links, ...rest } = macro

  return NextResponse.json({
    macro: {
      ...rest,
      tagObjects,
      last_updated_relative: relativeTime(macro.updated_at),
      last_used_relative:    relativeTime(macro.last_used_at),
    },
    currentUserRole: ctx.role,
  })
}

// PATCH /api/macros/[id] — update name/body/language/tags
export async function PATCH(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageMacros(ctx.role)) {
    return NextResponse.json({ error: 'You do not have permission to edit macros.', code: 'permission_denied' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  let payload
  try {
    payload = sanitizeMacroInput(body, { partial: true })
  } catch (e) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: 400 })
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'Nothing to update', code: 'no_changes' }, { status: 400 })
  }

  const { data: macro, error } = await supabaseAdmin
    .from('macros')
    .update(payload)
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select()
    .single()

  if (error || !macro) {
    console.error('[macros PATCH] update failed:', error?.message)
    const status = error?.code === 'PGRST116' ? 404 : 500
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update macro', code: status === 404 ? 'not_found' : 'update_failed' },
      { status }
    )
  }

  // Sync macro_tags whenever the caller sent a tags field (even an empty
  // array, which means "remove all tags"). If tags wasn't in the payload,
  // leave existing macro_tags untouched.
  let tagObjects = []
  if (Array.isArray(payload.tags)) {
    try {
      const tagMap = await ensureTagsByName(supabaseAdmin, ctx.workspaceId, payload.tags, ctx.user.id)
      const tagIds = Array.from(tagMap.values())
      await syncMacroTags(supabaseAdmin, macro.id, tagIds)
      const { data: linked } = await supabaseAdmin
        .from('tags')
        .select('id, name, color')
        .in('id', tagIds.length ? tagIds : ['00000000-0000-0000-0000-000000000000'])
      tagObjects = linked || []
    } catch (e) {
      console.error('[macros PATCH] tag sync failed (macro update succeeded):', e.message)
    }
  }

  return NextResponse.json({ macro: { ...macro, tagObjects } })
}

// DELETE /api/macros/[id] — hard delete (UI confirms first)
export async function DELETE(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.deleteMacros(ctx.role)) {
    return NextResponse.json({ error: 'Only owners and admins can delete macros.', code: 'permission_denied' }, { status: 403 })
  }

  const { id } = await params

  const { data: target, error: lookupError } = await supabaseAdmin
    .from('macros')
    .select('id, name')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    console.error('[macros DELETE] lookup failed:', lookupError.message)
    return NextResponse.json({ error: lookupError.message, code: 'lookup_failed' }, { status: 500 })
  }
  if (!target) return NextResponse.json({ error: 'Macro not found', code: 'not_found' }, { status: 404 })

  const { error: deleteError } = await supabaseAdmin
    .from('macros')
    .delete()
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (deleteError) {
    console.error('[macros DELETE] failed:', deleteError.message)
    return NextResponse.json({ error: deleteError.message, code: 'delete_failed' }, { status: 500 })
  }

  console.log('[macros DELETE] removed', id, 'name:', target.name, 'in workspace', ctx.workspaceId)
  return NextResponse.json({ ok: true })
}
