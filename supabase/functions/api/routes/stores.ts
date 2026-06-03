import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { deleteStore, disconnectStore } from '../lib/services/stores.ts'
import type { AuthContext } from '../lib/types.ts'

const stores = new Hono()
stores.use('*', authMiddleware)

function getCtx(c: { get: (key: string) => unknown }): AuthContext {
  return c.get('authContext') as AuthContext
}

// DELETE /stores/:id
stores.delete('/:id', async (c) => {
  const ctx = getCtx(c)

  if (ctx.role === 'observer') {
    return c.json({ error: 'Observers cannot delete stores', code: 'permission_denied' }, 403)
  }

  const storeId = c.req.param('id')
  await deleteStore(storeId, ctx.workspaceId)
  return c.json({ success: true })
})

// POST /stores/:id/disconnect
stores.post('/:id/disconnect', async (c) => {
  const ctx = getCtx(c)

  if (ctx.role === 'observer') {
    return c.json({ error: 'Observers cannot disconnect stores', code: 'permission_denied' }, 403)
  }

  const storeId = c.req.param('id')
  await disconnectStore(storeId, ctx.workspaceId)
  return c.json({ success: true })
})

export { stores as storeRoutes }
