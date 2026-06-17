import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { getAdminClient } from '../lib/supabase.ts'
import type { AuthContext } from '../lib/types.ts'
import { parseFilterParams, searchService, type SearchType } from '../lib/services/search.ts'

const ALLOWED_TYPES: SearchType[] = ['conversations', 'messages', 'contacts']
const Q_MIN = 2
const Q_MAX = 100
const LIMIT_DEFAULT = 5
const LIMIT_MAX = 25

const app = new Hono()
app.use('*', authMiddleware)

app.get('/', async (c) => {
  const ctx = c.get('authContext') as AuthContext

  const rawQ = c.req.query('q') ?? ''
  const q = rawQ.trim()
  if (q.length > Q_MAX) {
    return c.json({ error: `q must be at most ${Q_MAX} characters` }, 400)
  }

  const typesParam = c.req.query('types')
  let types: SearchType[]
  if (!typesParam) {
    types = ALLOWED_TYPES
  } else {
    const requested = typesParam.split(',').map((t) => t.trim()).filter(Boolean)
    types = requested.filter((t): t is SearchType =>
      (ALLOWED_TYPES as string[]).includes(t),
    )
    if (types.length === 0) {
      return c.json({ error: `types must contain at least one of: ${ALLOWED_TYPES.join(', ')}` }, 400)
    }
  }

  const limitParam = c.req.query('limit')
  let limit = LIMIT_DEFAULT
  if (limitParam) {
    const n = Number.parseInt(limitParam, 10)
    if (Number.isNaN(n) || n < 1) {
      return c.json({ error: 'limit must be a positive integer' }, 400)
    }
    limit = Math.min(n, LIMIT_MAX)
  }

  const parsed = parseFilterParams({
    status: c.req.query('status'),
    assignee: c.req.query('assignee'),
    dateFrom: c.req.query('dateFrom'),
    dateTo: c.req.query('dateTo'),
  })
  if (parsed.error) {
    return c.json({ error: parsed.error }, 400)
  }
  const filters = parsed.filters!

  const hasFilters =
    filters.status.length > 0 ||
    filters.assignee.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null

  if (q.length < Q_MIN && !hasFilters) {
    return c.json({ error: `q must be at least ${Q_MIN} characters` }, 400)
  }

  const sb = getAdminClient()
  const result = await searchService(sb, ctx.workspaceId, { q, types, filters, limit })
  return c.json(result)
})

export { app as searchRoutes }
