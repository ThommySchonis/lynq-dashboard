import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireNotImpersonating } from '../middleware/workspace.ts'
import { scheduleAccountDeletion } from '../lib/services/account-deletion.ts'
import type { AuthContext } from '../lib/types.ts'

const app = new Hono()

app.use('*', authMiddleware)

app.post('/delete', async (c) => {
  const ctx = c.get('authContext') as AuthContext
  const impBlock = requireNotImpersonating(c)
  if (impBlock) return impBlock

  const origin = c.req.header('origin')
    || c.req.header('referer')?.replace(/\/[^/]*$/, '')
    || 'https://lynq-dashboard.vercel.app'

  try {
    const result = await scheduleAccountDeletion(
      ctx.user.id,
      ctx.user.email ?? '',
      origin,
    )
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Account deletion failed'
    const conflict = message.includes('already scheduled')
      || message.includes('other members')
      || message.includes('pending ownership transfer')
      || message.includes('Transfer ownership')
    return c.json({ error: message }, conflict ? 409 : 500)
  }
})

export { app as accountRoutes }
