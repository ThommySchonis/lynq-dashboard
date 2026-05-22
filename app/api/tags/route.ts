import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { can } from '@/lib/permissions'
import type { Role } from '@/types/database'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateBody } from '@/lib/validation'
import { createTagBody } from '@/lib/schemas/tags'

// GET /api/tags — list workspace tags + macro_count per tag
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewTags(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  if (!can.manageTags(ctx.role as Role)) {
    return NextResponse.json({ error: 'You do not have permission to create tags.', code: 'permission_denied' }, { status: 403 })
  }

  const [body, err] = await validateBody(request, createTagBody)
  if (err) return err

  const { data: tag, error } = await supabaseAdmin
    .from('tags')
    .insert({
      workspace_id: ctx.workspaceId,
      name: body.name,
      color: body.color,
      description: body.description || null,
      created_by:  ctx.user.id,
    })
    .select('id, name, color, description, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `A tag named "${body.name}" already exists.`, code: 'duplicate' }, { status: 409 })
    }
    console.error('[tags POST] insert failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ tag: { ...tag, macro_count: 0 } }, { status: 201 })
}
