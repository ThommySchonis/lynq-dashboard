import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sanitizeMacroInput, relativeTime } from '@/lib/macros'
import { ensureTagsByName, syncMacroTags } from '@/lib/tags'
import { validateQuery } from '@/lib/validation'
import { getMacrosQuery } from '@/lib/schemas/macros'
import { sanitizeLikeInput } from '@/lib/sanitize'

interface TagLink {
  tag: unknown
}

interface MacroInputError {
  message?: string
  code?: string
}

// GET /api/macros — list macros for the current workspace
// Filters: ?archived=true|false (default false), ?search=, ?language=, ?tags=tag1,tag2
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.viewMacros(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [query, qErr] = validateQuery(request, getMacrosQuery)
  if (qErr) return qErr

  const archived = query.archived === 'true'
  const search   = query.search?.trim() ?? ''
  const language = query.language ?? ''
  const tagsCsv  = query.tags ?? ''
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
  if (search)         q = q.ilike('name', `%${sanitizeLikeInput(search)}%`)
  if (language)       q = q.eq('language', language)
  if (tagList.length) q = q.contains('tags', tagList)

  const { data: rows, error } = await q

  if (error) {
    console.error('[macros GET] query failed:', error.message)
    return NextResponse.json({ error: error.message, code: 'lookup_failed' }, { status: 500 })
  }

  const macros = ((rows || []) as Record<string, unknown>[]).map(m => {
    const tagObjects = Array.isArray(m.tag_links)
      ? (m.tag_links as TagLink[]).map((l: TagLink) => l.tag).filter(Boolean)
      : []
    const { tag_links: _tag_links, ...rest } = m
    return {
      ...rest,
      tagObjects,
      last_updated_relative: relativeTime(m.updated_at as string | null | undefined),
      last_used_relative:    relativeTime(m.last_used_at as string | null | undefined),
    }
  })

  return NextResponse.json({ macros, currentUserRole: ctx.role })
}

// POST /api/macros — create a new macro
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.manageMacros(ctx.role as Role)) {
    return NextResponse.json({ error: 'You do not have permission to create macros.', code: 'permission_denied' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>

  let payload
  try {
    payload = sanitizeMacroInput(body)
  } catch (err: unknown) {
    const e = err as MacroInputError
    return NextResponse.json({ error: e.message, code: e.code }, { status: 400 })
  }

  const macroResult = await supabaseAdmin
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

  const macro = macroResult.data as Record<string, unknown> | null

  if (macroResult.error || !macro) {
    console.error('[macros POST] insert failed:', macroResult.error?.message)
    return NextResponse.json({ error: macroResult.error?.message ?? 'Failed to create macro', code: 'insert_failed' }, { status: 500 })
  }

  // Sync macro_tags (new join table) — ensures the tags exist as rows
  // in the tags table and links them to this macro. Names that don't
  // exist yet are auto-created with 'slate' color.
  let tagObjects: unknown[] = []
  if (Array.isArray(payload.tags) && payload.tags.length > 0) {
    try {
      const tagMap = await ensureTagsByName(supabaseAdmin, ctx.workspaceId, payload.tags as string[], ctx.user.id)
      const tagIds = Array.from(tagMap.values()) as string[]
      await syncMacroTags(supabaseAdmin, macro.id as string, tagIds)
      // Fetch the linked tags so the response includes id+color (UI needs it)
      const { data: linked } = await supabaseAdmin
        .from('tags')
        .select('id, name, color')
        .in('id', tagIds)
      tagObjects = linked || []
    } catch (err: unknown) {
      console.error('[macros POST] tag sync failed (macro itself was created):', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  console.log('[macros POST] created', macro.id, 'in workspace', ctx.workspaceId)
  return NextResponse.json({ macro: { ...macro, tagObjects } }, { status: 201 })
}
