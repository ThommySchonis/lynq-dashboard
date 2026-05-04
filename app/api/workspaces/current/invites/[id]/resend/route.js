import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../../../lib/auth'
import { can } from '../../../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../../../lib/supabaseAdmin'
import { sendInviteEmail } from '../../../../../../../lib/email'

function getSiteUrl(request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const host  = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : ''
}

// POST — resend invite email + extend expiry by 7 days. Idempotent.
export async function POST(request, { params }) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.inviteMembers(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: invite, error: lookupError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id, email, role, token, accepted_at')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle()

  if (lookupError) {
    console.error('[invites resend] lookup failed:', lookupError.message)
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }
  if (!invite)         return NextResponse.json({ error: 'Invite not found' },     { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 410 })

  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const now       = new Date().toISOString()

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('workspace_invites')
    .update({ expires_at: newExpiry, sent_at: now })
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .select('id, email, role, token, expires_at, sent_at')
    .single()

  if (updateError || !updated) {
    console.error('[invites resend] update failed:', updateError?.message)
    return NextResponse.json({ error: updateError?.message ?? 'Failed to update invite' }, { status: 500 })
  }

  const siteUrl    = getSiteUrl(request)
  const inviteLink = siteUrl ? `${siteUrl}/invites/${updated.token}` : null

  const emailResult = await sendInviteEmail({
    to:            updated.email,
    workspaceName: ctx.workspace.name,
    inviterEmail:  ctx.user.email,
    role:          updated.role,
    link:          inviteLink,
  })

  console.log('[invites resend]', { id: updated.id, email: updated.email, emailStatus: emailResult.status })

  return NextResponse.json({
    ok:          true,
    invite:      updated,
    inviteLink,
    emailStatus: emailResult.status,
    emailError:  emailResult.error ?? null,
  })
}
