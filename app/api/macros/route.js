import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../lib/auth'
import { can } from '../../../lib/permissions'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { sanitizeMacroInput, relativeTime } from '../../../lib/macros'
import { ensureTagsByName, syncMacroTags } from '../../../lib/tags'

// GET /api/macros — list macros for the current workspace
// Filters: ?archived=true|false (default false), ?search=, ?language=, ?tags=tag1,tag2
export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewMacros(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const archived = searchParams.get('archived') === 'true'
  const search   = searchParams.get('search')?.trim() ?? ''
  const language = searchParams.get('language') ?? ''
  const tagsCsv  = searchParams.get('tags') ?? ''
  const tagList  = tagsCsv ? tagsCsv.split(',').map(t => t.trim()).filter(Boolean) : []

  let q = supabaseAdmin
    .from('macros')
    .select(`
      id, name, body, language, tags, usage_count, last_used_at, archived_at, created_at, updated_at, created_by,
      tag_links:macro_tags(tag:tags(id, name, color))
    `)
    .eq('workspace_id', ctx.workspaceId)
    .order('updated_at', { ascending: false })
    .limit(500)

  q = archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null)
  if (search)         q = q.ilike('name', `%${search}%`)
  if (language)       q = q.eq('language', language)
  if (tagList.length) q = q.contains('tags', tagList)

  const { data: rows, error } = await q

  if (error) {
    console.error('[macros GET] query failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'lookup_failed' }, { status: 500 })
  }

  const macros = (rows || []).map(m => {
    const tagObjects = Array.isArray(m.tag_links)
      ? m.tag_links.map(l => l.tag).filter(Boolean)
      : []
    const { tag_links, ...rest } = m
    return {
      ...rest,
      tagObjects,
      last_updated_relative: relativeTime(m.updated_at),
      last_used_relative:    relativeTime(m.last_used_at),
    }
  })

  return NextResponse.json({ macros, currentUserRole: ctx.role })
}

// POST /api/macros — create a new macro
export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageMacros(ctx.role)) {
    return NextResponse.json({ error: 'You do not have permission to create macros.', code: 'permission_denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))

  let payload
  try {
    payload = sanitizeMacroInput(body)
  } catch (e) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: 400 })
  }

  const { data: macro, error } = await supabaseAdmin
    .from('macros')
    .insert({
      workspace_id: ctx.workspaceId,
      name:         payload.name,
      body:         payload.body ?? '',
      language:     payload.language ?? 'auto',
      tags:         payload.tags ?? [],
      created_by:   ctx.user.id,
    })
    .select()
    .single()

  if (error || !macro) {
    console.error('[macros POST] insert failed:', error?.message)
    return NextResponse.json({ error: error?.message ?? 'Failed to create macro', code: 'insert_failed' }, { status: 500 })
  }

  // Sync macro_tags (new join table) — ensures the tags exist as rows
  // in the tags table and links them to this macro. Names that don't
  // exist yet are auto-created with 'slate' color.
  let tagObjects = []
  if (Array.isArray(payload.tags) && payload.tags.length > 0) {
    try {
      const tagMap = await ensureTagsByName(supabaseAdmin, ctx.workspaceId, payload.tags, ctx.user.id)
      const tagIds = Array.from(tagMap.values())
      await syncMacroTags(supabaseAdmin, macro.id, tagIds)
      // Fetch the linked tags so the response includes id+color (UI needs it)
      const { data: linked } = await supabaseAdmin
        .from('tags')
        .select('id, name, color')
        .in('id', tagIds)
      tagObjects = linked || []
    } catch (e) {
      console.error('[macros POST] tag sync failed (macro itself was created):', e.message)
    }
  }

  console.log('[macros POST] created', macro.id, 'in workspace', ctx.workspaceId)
  return NextResponse.json({ macro: { ...macro, tagObjects } }, { status: 201 })
}
