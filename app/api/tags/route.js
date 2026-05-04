import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../lib/auth'
import { can } from '../../../lib/permissions'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { TAG_COLORS, sanitizeTagName } from '../../../lib/tags'

// GET /api/tags — list workspace tags + macro_count per tag
export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewTags(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rows, error } = await supabaseAdmin
    .from('tags')
    .select('id, name, color, description, created_at, updated_at, macro_count:macro_tags(count)')
    .eq('workspace_id', ctx.workspaceId)
    .order('name', { ascending: true })

  if (error) {
    console.error('[tags GET] failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'lookup_failed' }, { status: 500 })
  }

  // Flatten macro_count: Supabase returns `[{count: N}]` — pull out the int
  const tags = (rows || []).map(t => ({
    ...t,
    macro_count: Array.isArray(t.macro_count) ? (t.macro_count[0]?.count ?? 0) : (t.macro_count ?? 0),
  }))

  return NextResponse.json({ tags, currentUserRole: ctx.role })
}

// POST /api/tags — create a new tag
export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageTags(ctx.role)) {
    return NextResponse.json({ error: 'You do not have permission to create tags.', code: 'permission_denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const name = sanitizeTagName(body.name)
  if (!name) return NextResponse.json({ error: 'Name is required', code: 'name_required' }, { status: 400 })

  const color = TAG_COLORS.includes(body.color) ? body.color : 'slate'
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 200) : null

  const { data: tag, error } = await supabaseAdmin
    .from('tags')
    .insert({
      workspace_id: ctx.workspaceId,
      name,
      color,
      description: description || null,
      created_by:  ctx.user.id,
    })
    .select('id, name, color, description, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `A tag named "${name}" already exists.`, code: 'duplicate' }, { status: 409 })
    }
    console.error('[tags POST] insert failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ tag: { ...tag, macro_count: 0 } }, { status: 201 })
}
