import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { RouteContext } from '@/types/api'
import type { Role } from '@/types/database'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendInviteEmail } from '@/lib/email'
import { validateParams } from '@/lib/validation'
import { inviteParams } from '@/lib/schemas/workspaces'
import { getSiteUrl } from '@/lib/utils/request'
import { logger } from '@/lib/logger'

// POST — resend invite email + extend expiry by 7 days. Idempotent.
export async function POST(request: NextRequest, { params: routeParams }: RouteContext<{ id: string }>) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  if (!can.inviteMembers(ctx.role as Role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [params, paramErr] = validateParams(await routeParams, inviteParams)
  if (paramErr) return paramErr

  const { data: invite, error: lookupError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id, email, role, token, accepted_at')
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    logger.error('[invites]', 'resend lookup failed', { message: lookupError.message })
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }
  if (!invite)         return NextResponse.json({ error: 'Invite not found' },     { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })

  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const now       = new Date().toISOString()

  interface UpdatedInvite { id: string; email: string; role: string; token: string; expires_at: string; sent_at: string }
  const updateResult = await supabaseAdmin
    .from('workspace_invites')
    .update({ expires_at: newExpiry, sent_at: now })
    .eq('id', params.id)
    .eq('workspace_id', ctx.workspaceId)
    .select('id, email, role, token, expires_at, sent_at')
    .single()

  const updated = updateResult.data as UpdatedInvite | null
  if (updateResult.error || !updated) {
    logger.error('[invites]', 'resend update failed', { message: updateResult.error?.message })
    return NextResponse.json({ error: updateResult.error?.message ?? 'Failed to update invite' }, { status: 500 })
  }

  const siteUrl    = getSiteUrl(request)
  const inviteLink = siteUrl ? `${siteUrl}/invites/${updated.token}` : null

  const emailResult = await sendInviteEmail({
    to:            updated.email,
    workspaceName: ctx.workspace.name,
    inviterEmail:  ctx.user.email ?? '',
    role:          updated.role,
    link:          inviteLink,
  })

  logger.info('[invites]', 'invite resent', { inviteId: updated.id, emailStatus: emailResult.status })

  return NextResponse.json({
    ok:          true,
    invite:      updated,
    inviteLink,
    emailStatus: emailResult.status,
    emailError:  emailResult.error ?? null,
  })
}
