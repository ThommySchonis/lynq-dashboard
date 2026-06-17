import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireCapability } from '../middleware/workspace.ts'
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

  const blocked = requireCapability('manageWorkspace')(c)
  if (blocked) return blocked

  const storeId = c.req.param('id')
  await deleteStore(storeId, ctx.workspaceId)
  return c.json({ success: true })
})

// POST /stores/:id/disconnect
stores.post('/:id/disconnect', async (c) => {
  const ctx = getCtx(c)

  const blocked = requireCapability('manageWorkspace')(c)
  if (blocked) return blocked

  const storeId = c.req.param('id')
  await disconnectStore(storeId, ctx.workspaceId)
  return c.json({ success: true })
})

export { stores as storeRoutes }
