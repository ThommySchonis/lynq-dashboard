import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { requireWriteAccess, requireNotImpersonating } from '../middleware/workspace.ts'
import { can } from '../lib/permissions.ts'
import { getAdminClient } from '../lib/supabase.ts'
import { cancelSubscription } from '../lib/services/billing.ts'
import { sendInviteEmail } from '../lib/email.ts'
import { getPendingTransfer, initiateTransfer } from '../lib/services/ownership-transfer.ts'
import { logger } from '../lib/logger.ts'
import type { AuthContext } from '../lib/types.ts'

type Role = 'owner' | 'admin' | 'agent' | 'observer'

function getCtx(c: { get: (key: string) => unknown }): AuthContext {
  return c.get('authContext') as AuthContext
}

const app = new Hono()

app.use('*', authMiddleware)

// ── POST /delete — Schedule workspace deletion ─────────────────────

app.post('/delete', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked
  const impBlock = requireNotImpersonating(c)
  if (impBlock) return impBlock
  if (!can.deleteWorkspace(ctx.role as Role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const sb = getAdminClient()

  // Try to cancel subscription (silently catch errors)
  try {
    await cancelSubscription(ctx.workspaceId, false)
  } catch {
    // Subscription may not exist or already cancelled
  }

  // Schedule workspace for deletion in 7 days
  const scheduledFor = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: updateError } = await sb
    .from('workspaces')
    .update({ scheduled_for_deletion_at: scheduledFor })
    .eq('id', ctx.workspaceId)

  if (updateError) {
    return c.json({ error: updateError.message }, 500)
  }

  // Log to workspace_deletion_log
  await sb.from('workspace_deletion_log').insert({
    workspace_id: ctx.workspaceId,
    event: 'scheduled',
    actor_id: ctx.user.id,
    metadata: { scheduled_for: scheduledFor },
  })

  return c.json({ scheduledFor })
})

// ── POST /members — Invite a member ────────────────────────────────

app.post('/members', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked
  const impBlock = requireNotImpersonating(c)
  if (impBlock) return impBlock
  if (!can.inviteMembers(ctx.role as Role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const body = await c.req.json<{ email: string; role: string }>()
  const { email, role } = body

  if (!email || !role) {
    return c.json({ error: 'email and role are required' }, 400)
  }

  const sb = getAdminClient()

  // Rate limit: max 20 invites in 60 seconds
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const { count: recentCount, error: countError } = await sb
    .from('workspace_invites')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId)
    .gte('sent_at', sixtySecondsAgo)

  if (countError) {
    return c.json({ error: 'Rate limit check failed' }, 500)
  }
  if ((recentCount ?? 0) >= 20) {
    return c.json({ error: 'Too many invites. Please wait before sending more.' }, 429)
  }

  // Check if already a member
  const { data: existingMember } = await sb
    .from('workspace_member_details')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('email', email)
    .maybeSingle()

  if (existingMember) {
    return c.json({ error: 'User is already a member of this workspace' }, 409)
  }

  // Reject inviting someone who already belongs to ANY workspace (their own or
  // another). The app has no workspace switcher, so a second membership would be
  // unreachable — invites are only for people without an existing workspace.
  // `.limit(1)` keeps `.maybeSingle()` safe even for a multi-workspace email.
  const { data: priorMembership } = await sb
    .from('workspace_member_details')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (priorMembership) {
    return c.json({
      error: 'This person already has a workspace. Invites can only be sent to people without an existing account.',
      code: 'already_has_workspace',
    }, 409)
  }

  // Check for existing pending invite
  const { data: existingInvite } = await sb
    .from('workspace_invites')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('email', email)
    .is('accepted_at', null)
    .maybeSingle()

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  let invite: Record<string, unknown> | null = null

  if (existingInvite) {
    // Update existing pending invite with new token and expiry
    const { data: updated, error: updateError } = await sb
      .from('workspace_invites')
      .update({
        token,
        role,
        expires_at: expiresAt,
        sent_at: now,
        invited_by: ctx.user.id,
      })
      .eq('id', (existingInvite as { id: string }).id)
      .select()
      .single()

    if (updateError) return c.json({ error: updateError.message }, 500)
    invite = updated as Record<string, unknown>
  } else {
    // Insert new invite
    const { data: created, error: insertError } = await sb
      .from('workspace_invites')
      .insert({
        workspace_id: ctx.workspaceId,
        email,
        role,
        token,
        expires_at: expiresAt,
        sent_at: now,
        invited_by: ctx.user.id,
      })
      .select()
      .single()

    if (insertError) return c.json({ error: insertError.message }, 500)
    invite = created as Record<string, unknown>
  }

  // Build invite link
  const origin = c.req.header('origin')
    || c.req.header('referer')?.replace(/\/[^/]*$/, '')
    || null
  const inviteLink = origin ? `${origin}/invites/${token}` : null

  // Send invite email
  const emailResult = await sendInviteEmail({
    to: email,
    workspaceName: ctx.workspace.name,
    inviterEmail: ctx.user.email ?? '',
    role,
    link: inviteLink,
  })

  return c.json({
    invite,
    inviteLink,
    emailStatus: emailResult.status,
    emailError: 'error' in emailResult ? emailResult.error : undefined,
  }, 201)
})

// ── POST /invites/:id/resend — Resend an invite ────────────────────

app.post('/invites/:id/resend', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked
  const impBlock = requireNotImpersonating(c)
  if (impBlock) return impBlock
  if (!can.inviteMembers(ctx.role as Role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const inviteId = c.req.param('id')
  const sb = getAdminClient()

  // Look up invite
  const { data: invite, error: lookupError } = await sb
    .from('workspace_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('workspace_id', ctx.workspaceId)
    .is('accepted_at', null)
    .maybeSingle()

  if (lookupError) return c.json({ error: lookupError.message }, 500)
  if (!invite) return c.json({ error: 'Invite not found or already accepted' }, 404)

  const typedInvite = invite as Record<string, unknown>
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Update expires_at and sent_at
  const { data: updated, error: updateError } = await sb
    .from('workspace_invites')
    .update({ expires_at: expiresAt, sent_at: now })
    .eq('id', inviteId)
    .select()
    .single()

  if (updateError) return c.json({ error: updateError.message }, 500)

  // Build invite link
  const origin = c.req.header('origin')
    || c.req.header('referer')?.replace(/\/[^/]*$/, '')
    || null
  const token = (updated as Record<string, unknown>).token as string
  const inviteLink = origin ? `${origin}/invites/${token}` : null

  // Send email
  const emailResult = await sendInviteEmail({
    to: typedInvite.email as string,
    workspaceName: ctx.workspace.name,
    inviterEmail: ctx.user.email ?? '',
    role: typedInvite.role as string,
    link: inviteLink,
  })

  return c.json({
    ok: true,
    invite: updated,
    inviteLink,
    emailStatus: emailResult.status,
    emailError: 'error' in emailResult ? emailResult.error : undefined,
  })
})

// ── GET /transfer-ownership — Get pending transfer ─────────────────

app.get('/transfer-ownership', async (c) => {
  const ctx = getCtx(c)

  const transfer = await getPendingTransfer(ctx.workspaceId)
  return c.json({ transfer })
})

// ── POST /transfer-ownership — Initiate ownership transfer ─────────

app.post('/transfer-ownership', async (c) => {
  const ctx = getCtx(c)
  const blocked = requireWriteAccess(c)
  if (blocked) return blocked
  const impBlock = requireNotImpersonating(c)
  if (impBlock) return impBlock
  if (!can.deleteWorkspace(ctx.role as Role)) {
    return c.json({ error: 'Forbidden — owner only' }, 403)
  }

  const body = await c.req.json<{ toUserId: string; newRoleForOldOwner: string }>()
  const { toUserId, newRoleForOldOwner } = body

  if (!toUserId || !newRoleForOldOwner) {
    return c.json({ error: 'toUserId and newRoleForOldOwner are required' }, 400)
  }

  try {
    const transfer = await initiateTransfer(
      ctx.workspaceId,
      ctx.user.id,
      toUserId,
      newRoleForOldOwner,
    )

    // Look up target user email and send notification
    const sb = getAdminClient()
    const { data: targetUser } = await sb.auth.admin.getUserById(toUserId)

    if (targetUser?.user?.email) {
      const apiKey = Deno.env.get('RESEND_API_KEY')
      if (apiKey) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: Deno.env.get('INVITE_EMAIL_FROM') || 'Lynq & Flow <onboarding@resend.dev>',
              to: targetUser.user.email,
              subject: `Ownership transfer request for ${ctx.workspace.name}`,
              html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C0F36;max-width:480px;margin:0 auto;padding:24px;">
                  <h2 style="font-size:18px;font-weight:600;margin:0 0 12px;">Ownership Transfer Request</h2>
                  <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
                    <strong style="color:#1C0F36;">${ctx.user.email}</strong> wants to transfer ownership of
                    <strong style="color:#1C0F36;">${ctx.workspace.name}</strong> to you.
                  </p>
                  <p style="font-size:14px;line-height:1.6;color:#6B5E7B;margin:0 0 20px;">
                    Log in to your dashboard to accept or decline this transfer. This request expires in 7 days.
                  </p>
                  <p style="font-size:12px;color:#9B91A8;margin:0;">
                    If you didn't expect this, you can safely ignore it.
                  </p>
                </div>
              `,
            }),
          })
        } catch (emailErr) {
          logger.warn('[workspace-actions]', 'Transfer email send failed', {
            error: emailErr instanceof Error ? emailErr.message : 'unknown',
          })
        }
      }
    }

    return c.json({ transfer }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transfer failed'
    return c.json({ error: message }, 400)
  }
})

export { app as workspaceActionRoutes }
