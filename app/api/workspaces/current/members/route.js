import { NextResponse } from 'next/server'
import { getAuthContext } from '../../../../../lib/auth'
import { can } from '../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

// GET — list workspace members + pending invites
export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabaseAdmin
      .from('workspace_members')
      .select('id, user_id, role, joined_at, users:user_id(email, raw_user_meta_data)')
      .eq('workspace_id', ctx.workspaceId)
      .order('joined_at', { ascending: true }),
    supabaseAdmin
      .from('workspace_invites')
      .select('id, email, role, token, created_at, expires_at, invited_by')
      .eq('workspace_id', ctx.workspaceId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  // Flatten auth user metadata into each member row
  const shaped = (members || []).map(m => ({
    id:        m.id,
    user_id:   m.user_id,
    role:      m.role,
    joined_at: m.joined_at,
    email:     m.users?.email ?? null,
    name:      m.users?.raw_user_meta_data?.name ?? null,
  }))

  return NextResponse.json({ members: shaped, invites: invites || [] })
}

// POST — invite a new member by email
export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.inviteMembers(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role = 'agent' } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!['admin', 'agent', 'observer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  // Check if already a member
  const { data: existingUser } = await supabaseAdmin
    .from('workspace_members')
    .select('id, users:user_id(email)')
    .eq('workspace_id', ctx.workspaceId)
    .filter('users.email', 'eq', email.toLowerCase())
    .maybeSingle()

  if (existingUser) return NextResponse.json({ error: 'This person is already a member' }, { status: 400 })

  // Upsert invite (reset token + expiry if re-inviting)
  const { data: invite, error } = await supabaseAdmin
    .from('workspace_invites')
    .upsert(
      {
        workspace_id: ctx.workspaceId,
        email:        email.toLowerCase().trim(),
        role,
        invited_by:   ctx.user.id,
        accepted_at:  null,
        expires_at:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'workspace_id,email', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send invite email via Resend if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/invites/${invite.token}`
      await resend.emails.send({
        from:    'Lynq & Flow <noreply@lynqflow.com>',
        to:      email,
        subject: `You've been invited to ${ctx.workspace.name}`,
        html: `
          <p>Hi,</p>
          <p><strong>${ctx.user.email}</strong> has invited you to join <strong>${ctx.workspace.name}</strong> on Lynq &amp; Flow as ${role === 'admin' ? 'an Admin' : 'a Member'}.</p>
          <p><a href="${inviteUrl}" style="background:#A175FC;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
          <p style="color:#9B91A8;font-size:12px;">This link expires in 7 days.</p>
        `,
      })
    } catch (_) {
      // Email sending is best-effort — don't fail the invite
    }
  }

  const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/invites/${invite.token}`
  return NextResponse.json({ invite, inviteLink }, { status: 201 })
}
