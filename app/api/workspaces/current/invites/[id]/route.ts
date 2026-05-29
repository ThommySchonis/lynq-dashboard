import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import type { Role } from '@/types/database'
import { getAuthContext, requireWriteAccess, requireNotImpersonating } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { validateParams } from '@/lib/validation'
import { inviteParams } from '@/lib/schemas/workspaces'
import { logger } from '@/lib/logger'

interface InviteRow {
  email: string
}

// DELETE — revoke a pending invite
export async function DELETE(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  const impersonationBlocked = requireNotImpersonating(ctx)
  if (impersonationBlocked) return impersonationBlocked
  if (!can.removeMembers(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [params, paramErr] = validateParams(await routeParams, inviteParams)
  if (paramErr) return paramErr

  const { data: invite, error: lookupError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id, email')
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    logger.error('[invites]', 'DELETE lookup failed', { message: lookupError.message })
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

  const { error: deleteError } = await supabaseAdmin
    .from('workspace_invites')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)

  if (deleteError) {
    logger.error('[invites]', 'DELETE failed', { message: deleteError.message })
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  logger.info('[invites]', 'invite revoked', { inviteId: params.id, workspaceId: ctx.workspaceId })
  return NextResponse.json({ ok: true, email: (invite as InviteRow).email })
}
