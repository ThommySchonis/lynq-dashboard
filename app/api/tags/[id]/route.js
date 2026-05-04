import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../lib/auth'
import { can } from '../../../../lib/permissions'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { TAG_COLORS, sanitizeTagName } from '../../../../lib/tags'

// GET /api/tags/[id]
export async function GET(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewTags(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: tag, error } = await supabaseAdmin
    .from('tags')
    .select('id, name, color, description, created_at, updated_at, macro_count:macro_tags(count)')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message, code: 'lookup_failed' }, { status: 500 })
  }
  if (!tag) return NextResponse.json({ error: 'Tag not found', code: 'not_found' }, { status: 404 })

  return NextResponse.json({
    tag: {
      ...tag,
      macro_count: Array.isArray(tag.macro_count) ? (tag.macro_count[0]?.count ?? 0) : (tag.macro_count ?? 0),
    },
  })
}

// PATCH /api/tags/[id] — update name/color/description
export async function PATCH(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageTags(ctx.role)) {
    return NextResponse.json({ error: 'You do not have permission to edit tags.', code: 'permission_denied' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const update = {}
  if (body.name !== undefined) {
    const name = sanitizeTagName(body.name)
    if (!name) return NextResponse.json({ error: 'Name cannot be empty', code: 'name_required' }, { status: 400 })
    update.name = name
  }
  if (body.color !== undefined) {
    if (!TAG_COLORS.includes(body.color)) {
      return NextResponse.json({ error: 'Invalid color', code: 'invalid_color' }, { status: 400 })
    }
    update.color = body.color
  }
  if (body.description !== undefined) {
    update.description = typeof body.description === 'string'
      ? body.description.trim().slice(0, 200) || null
      : null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update', code: 'no_changes' }, { status: 400 })
  }

  const { data: tag, error } = await supabaseAdmin
    .from('tags')
    .update(update)
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select('id, name, color, description, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `A tag named "${update.name}" already exists.`, code: 'duplicate' }, { status: 409 })
    }
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Tag not found', code: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message, code: 'update_failed' }, { status: 500 })
  }

  return NextResponse.json({ tag })
}

// DELETE /api/tags/[id] — hard delete (cascades to macro_tags)
export async function DELETE(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.deleteTags(ctx.role)) {
    return NextResponse.json({ error: 'Only owners and admins can delete tags.', code: 'permission_denied' }, { status: 403 })
  }

  const { id } = await params

  const { data: target } = await supabaseAdmin
    .from('tags')
    .select('id, name')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'Tag not found', code: 'not_found' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('tags')
    .delete()
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)

  if (error) {
    console.error('[tags DELETE] failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'delete_failed' }, { status: 500 })
  }

  console.log('[tags DELETE] removed', target.name, 'in workspace', ctx.workspaceId)
  return NextResponse.json({ ok: true })
}
