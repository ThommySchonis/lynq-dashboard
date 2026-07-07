import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.ts'
import { getAdminClient, getUserFromToken } from '../lib/supabase.ts'

const app = new Hono()

// ── Accept invite (requires auth) ──────────────────────────────────

app.post('/:token/accept', authMiddleware, async (c) => {
  const sb = getAdminClient()
  const token = c.req.param('token')

  const authHeader = c.req.header('authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)

  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  interface RpcResult { ok?: boolean; error?: string; workspace_id?: string; invite_email?: string; user_email?: string }

  const rpcResponse = await sb.rpc('accept_workspace_invite', {
    p_token: token,
    p_user_id: user.id,
  })

  if (rpcResponse.error) {
    return c.json({ error: 'Failed to accept invite' }, 500)
  }

  const result = rpcResponse.data as RpcResult | null

  if (result?.ok) {
    return c.json({ success: true, workspaceId: result.workspace_id })
  }

  const code = result?.error
  switch (code) {
    case 'not_found':
      return c.json({ error: 'Invite not found', code }, 404)
    case 'expired':
      return c.json({ error: 'Invite has expired', code }, 410)
    case 'user_not_found':
      return c.json({ error: 'User not found', code }, 404)
    case 'email_mismatch':
      return c.json({
        error: `This invite is for ${result?.invite_email ?? 'unknown'}. Sign in with that account.`,
        code,
        invite_email: result?.invite_email,
        user_email: result?.user_email,
      }, 409)
    case 'already_accepted':
      return c.json({ error: 'Invite already accepted', code }, 410)
    case 'already_member':
      return c.json({
        error: 'You already belong to a workspace. Invites can only be accepted by accounts without an existing workspace.',
        code,
      }, 409)
    default:
      return c.json({ error: 'Invite could not be accepted' }, 500)
  }
})

// ── Signup via invite (public, no auth) ────────────────────────────

app.post('/:token/signup', async (c) => {
  const sb = getAdminClient()
  const token = c.req.param('token')
  const body = await c.req.json<{ full_name: string; password: string }>()

  const cleanName = body.full_name
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)

  if (!cleanName) {
    return c.json({ error: 'Full name is required', code: 'name_required' }, 400)
  }

  interface InviteRow { id: string; workspace_id: string; email: string; role: string; expires_at: string; accepted_at: string | null }

  const inviteResult = await sb
    .from('workspace_invites')
    .select('id, workspace_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (inviteResult.error) return c.json({ error: 'Lookup failed', code: 'lookup_failed' }, 500)

  const invite = inviteResult.data as InviteRow | null
  if (!invite) return c.json({ error: 'Invite not found', code: 'not_found' }, 404)
  if (invite.accepted_at) return c.json({ error: 'This invite has already been accepted', code: 'already_accepted' }, 410)
  if (new Date(invite.expires_at) < new Date()) return c.json({ error: 'This invite has expired', code: 'expired' }, 410)

  const { data: created, error: createError } = await sb.auth.admin.createUser({
    email: invite.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { name: cleanName },
  })

  if (createError) {
    const msg = createError.message || ''
    if (/already (registered|exists)|email.+already/i.test(msg)) {
      return c.json({ error: 'An account already exists for this email. Sign in instead.', code: 'email_exists' }, 409)
    }
    if (/password/i.test(msg)) {
      return c.json({ error: msg, code: 'weak_password' }, 400)
    }
    return c.json({ error: msg || 'Signup failed', code: 'signup_failed' }, 500)
  }

  const newUserId = created?.user?.id
  if (!newUserId) return c.json({ error: 'Signup failed', code: 'signup_failed' }, 500)

  interface RpcResult { ok?: boolean; error?: string }
  const rpcResponse = await sb.rpc('accept_workspace_invite', {
    p_token: token,
    p_user_id: newUserId,
  })

  if (rpcResponse.error) {
    return c.json({ error: rpcResponse.error.message, code: 'accept_failed' }, 500)
  }

  const acceptResult = rpcResponse.data as RpcResult | null
  if (!acceptResult?.ok) {
    return c.json({ error: acceptResult?.error ?? 'Failed to accept invite', code: 'accept_failed' }, 500)
  }

  return c.json({ ok: true, workspace_id: invite.workspace_id, email: invite.email })
})

export { app as inviteRoutes }
