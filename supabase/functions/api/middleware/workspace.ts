import type { Context } from 'hono'
import type { AuthContext } from '../lib/types.ts'

export function requireWriteAccess(c: Context): Response | null {
  const ctx = c.get('authContext') as AuthContext
  if (ctx.isSuspended) {
    return c.json(
      { error: 'workspace_suspended', message: 'This workspace is currently suspended. Write operations are disabled.' },
      403
    )
  }
  return null
}

export function requireNotImpersonating(c: Context): Response | null {
  const ctx = c.get('authContext') as AuthContext
  if (ctx.isImpersonating) {
    return c.json(
      { error: 'impersonation_restricted', message: 'This action is not available during impersonation.' },
      403
    )
  }
  return null
}
