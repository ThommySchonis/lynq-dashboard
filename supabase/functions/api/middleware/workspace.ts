import type { Context } from 'hono'
import type { AuthContext } from '../lib/types.ts'
import { can, type Role } from '../lib/permissions.ts'

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

/**
 * Returns a guard that blocks the request with 403 unless the current role
 * satisfies the given capability. Use alongside requireWriteAccess:
 *   const blocked = requireWriteAccess(c) ?? requireCapability('manageOrders')(c)
 *   if (blocked) return blocked
 */
export function requireCapability(cap: keyof typeof can) {
  return (c: Context): Response | null => {
    const ctx = c.get('authContext') as AuthContext
    if (!can[cap](ctx.role as Role)) {
      return c.json(
        { error: 'forbidden', message: 'You do not have permission to perform this action.' },
        403,
      )
    }
    return null
  }
}
