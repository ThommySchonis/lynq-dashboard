import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { randomBytes } from 'node:crypto'
import { getAuthContext, requireWriteAccess, requireNotImpersonating } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendInviteEmail } from '@/lib/email'
import { validateBody } from '@/lib/validation'
import { inviteMemberBody } from '@/lib/schemas/workspaces'
import { getSiteUrl } from '@/lib/utils/request'
import { logger } from '@/lib/logger'

interface IdRow {
  id: string
}

// POST — invite a new member by email
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    logger.error('[members]', 'no auth context')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked
  const impersonationBlocked = requireNotImpersonating(ctx)
  if (impersonationBlocked) return impersonationBlocked
  if (!can.inviteMembers(ctx.role as Role)) {
    logger.error('[members]', 'role cannot invite members', { role: ctx.role })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [body, bodyErr] = await validateBody(request, inviteMemberBody)
  if (bodyErr) return bodyErr

  const { email, role } = body
  const normalizedEmail = email.toLowerCase().trim()
  logger.info('[members]', 'starting invite', { role, workspaceId: ctx.workspaceId })

  // Rate limit: max 20 invites in last 60s
  const { count: recentCount, error: rateError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId)
    .gt('created_at', new Date(Date.now() - 60_000).toISOString())

  if (rateError) logger.error('[members]', 'rate-limit query failed', { message: rateError.message })
  if ((recentCount ?? 0) >= 20) {
    return NextResponse.json({ error: 'Too many invites. Please wait a minute.' }, { status: 429 })
  }

  // Check if already a member (use view for email lookup)
  const { data: existingMember, error: memberError } = await supabaseAdmin
    .from('workspace_member_details')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (memberError) {
    logger.error('[members]', 'existing member check failed', { message: memberError.message })
    return NextResponse.json({ error: `Member lookup failed: ${memberError.message}` }, { status: 500 })
  }
  if (existingMember) {
    return NextResponse.json({ error: 'This person is already a member' }, { status: 400 })
  }

  // Look for an existing pending invite (accepted_at IS NULL). If one
  // exists we refresh it in place — new token, fresh expiry, new sent_at,
  // and invited_by/role updated to the current admin. Avoids the unique
  // constraint conflict on (workspace_id, email) for re-invites and gives
  // the user a fresh email instead of a stale 409.
  const { data: existingInvite, error: existingInviteError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('email', normalizedEmail)
    .is('accepted_at', null)
    .maybeSingle()

  if (existingInviteError) {
    logger.error('[members]', 'existing invite check failed', { message: existingInviteError.message })
    return NextResponse.json({ error: existingInviteError.message, code: 'lookup_failed' }, { status: 500 })
  }

  const newToken  = randomBytes(32).toString('hex')
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const nowIso    = new Date().toISOString()

  interface InviteRow { id: string; token: string; [key: string]: unknown }
  let invite: InviteRow
  if (existingInvite) {
    logger.info('[members]', 'refreshing pending invite', { inviteId: (existingInvite as IdRow).id })
    const updateResult = await supabaseAdmin
      .from('workspace_invites')
      .update({
        role,
        token:      newToken,
        expires_at: newExpiry,
        sent_at:    nowIso,
        invited_by: ctx.user.id,
      })
      .eq('id', (existingInvite as IdRow).id)
      .select()
      .single()

    if (updateResult.error || !updateResult.data) {
      logger.error('[members]', 'invite update failed', { message: updateResult.error?.message })
      return NextResponse.json({ error: updateResult.error?.message ?? 'Failed to refresh invite' }, { status: 500 })
    }
    invite = updateResult.data as InviteRow
  } else {
    // No pending invite — INSERT. Covers two cases:
    //   (a) brand-new email never invited
    //   (b) previously accepted user who was removed from workspace_members
    //       (the partial unique index `workspace_invites_active_unique` only
    //       blocks duplicates among rows where accepted_at IS NULL, so an
    //       old accepted row doesn't conflict)
    logger.info('[members]', 'creating new invite')
    const insertResult = await supabaseAdmin
      .from('workspace_invites')
      .insert({
        workspace_id: ctx.workspaceId,
        email:        normalizedEmail,
        role,
        invited_by:   ctx.user.id,
        token:        newToken,
        expires_at:   newExpiry,
        sent_at:      nowIso,
      })
      .select()
      .single()

    if (insertResult.error || !insertResult.data) {
      logger.error('[members]', 'invite insert failed', { message: insertResult.error?.message })
      return NextResponse.json({ error: insertResult.error?.message ?? 'Failed to create invite' }, { status: 500 })
    }
    invite = insertResult.data as InviteRow
  }

  logger.info('[members]', 'invite saved', { inviteId: invite.id, tokenLength: invite.token?.length })

  const siteUrl    = getSiteUrl(request)
  const inviteLink = siteUrl ? `${siteUrl}/invites/${invite.token}` : null

  if (!siteUrl) {
    logger.error('[members]', 'could not determine site URL — invite link unavailable')
  }

  // Send invite email via shared helper
  const emailResult = await sendInviteEmail({
    to:            normalizedEmail,
    workspaceName: ctx.workspace.name,
    inviterEmail:  ctx.user.email ?? '',
    role,
    link:          inviteLink,
  })

  logger.info('[members]', 'invite email sent', { status: emailResult.status })

  return NextResponse.json(
    {
      invite,
      inviteLink,
      emailStatus: emailResult.status,
      emailError:  emailResult.error ?? null,
    },
    { status: 201 }
  )
}
