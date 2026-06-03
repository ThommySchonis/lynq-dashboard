import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import {
  getWorkspaceFeatures,
  getSubscriptionWithUsage,
} from '../lib/services/billing.ts'
import type { AuthContext } from '../lib/types.ts'

const analyticsExtra = new Hono()
analyticsExtra.use('*', authMiddleware)

function getCtx(c: { get: (key: string) => unknown }): AuthContext {
  return c.get('authContext') as AuthContext
}

// GET /analytics/email-stats
analyticsExtra.get('/email-stats', async (c) => {
  const ctx = getCtx(c)

  const [features, subWithUsage] = await Promise.all([
    getWorkspaceFeatures(ctx.workspaceId),
    getSubscriptionWithUsage(ctx.workspaceId),
  ])

  const sent = subWithUsage?.usage?.emails_sent ?? 0

  c.header('Cache-Control', 'private, max-age=300')
  return c.json({
    sent,
    limit: features.email_limit,
    plan: subWithUsage?.plan?.display_name?.toLowerCase() ?? null,
  })
})

export { analyticsExtra as analyticsExtraRoutes }
