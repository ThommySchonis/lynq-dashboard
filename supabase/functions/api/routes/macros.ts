import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { can } from '../lib/permissions.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'

type Role = 'owner' | 'admin' | 'agent' | 'observer'

const macros = new Hono()
macros.use('*', authMiddleware)

function getCtx(c: { get: (key: string) => unknown }): AuthContext {
  return c.get('authContext') as AuthContext
}

function relativeTime(date: string | null | undefined): string | null {
  if (!date) return null
  const ms = Date.now() - new Date(date).getTime()
  if (ms < 0) return 'just now'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function sanitizeLikeInput(raw: string): string {
  return raw.replace(/[%_]/g, (ch) => '\\' + ch)
}

// GET /macros
macros.get('/', async (c) => {
  const ctx = getCtx(c)

  if (!can.viewMacros(ctx.role as Role)) {
    return c.json({ error: 'Permission denied', code: 'permission_denied' }, 403)
  }

  const archived = c.req.query('archived')
  const search = c.req.query('search')
  const language = c.req.query('language')
  const tags = c.req.query('tags')

  const sb = getAdminClient()

  let query = sb
    .from('macros')
    .select('*, tag_links:macro_tags(tag:tags(id, name, color))')
    .eq('workspace_id', ctx.workspaceId)

  if (archived === 'true') {
    query = query.eq('archived', true)
  } else {
    query = query.eq('archived', false)
  }

  if (search) {
    const sanitized = sanitizeLikeInput(search)
    query = query.ilike('title', `%${sanitized}%`)
  }

  if (language) {
    query = query.eq('language', language)
  }

  if (tags) {
    const tagIds = tags.split(',').map((t) => t.trim()).filter(Boolean)
    if (tagIds.length > 0) {
      query = query.in('id',
        sb
          .from('macro_tags')
          .select('macro_id')
          .in('tag_id', tagIds)
      )
    }
  }

  query = query.order('updated_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  interface TagLink {
    tag: { id: string; name: string; color: string } | null
  }

  interface MacroRow {
    tag_links: TagLink[]
    updated_at: string | null
    last_used_at: string | null
    [key: string]: unknown
  }

  const results = (data as unknown as MacroRow[]).map((macro) => ({
    ...macro,
    tagObjects: macro.tag_links
      ?.map((link) => link.tag)
      .filter(Boolean) ?? [],
    last_updated_relative: relativeTime(macro.updated_at),
    last_used_relative: relativeTime(macro.last_used_at),
  }))

  return c.json({ macros: results, currentUserRole: ctx.role })
})

export { macros as macroRoutes }
