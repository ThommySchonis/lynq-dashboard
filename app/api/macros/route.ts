import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { relativeTime } from '@/lib/macros'
import { validateQuery } from '@/lib/validation'
import { getMacrosQuery } from '@/lib/schemas/macros'
import { sanitizeLikeInput } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

interface TagLink {
  tag: unknown
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
    logger.error('[macros]', 'query failed', { error: error.message })
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
