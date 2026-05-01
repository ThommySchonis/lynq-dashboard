import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getAuthContext } from '../../../../../lib/auth'
import { can } from '../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

const ROLE_ORDER = { owner: 0, admin: 1, agent: 2, observer: 3 }

// GET — list workspace members + pending invites
export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search    = searchParams.get('q')?.trim().toLowerCase() || ''
  const roleParam = searchParams.get('role') || ''
  const cursor    = searchParams.get('cursor') || null
  const limit     = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  // Build members query from view (joins auth.users at postgres level)
  let membersQ = supabaseAdmin
    .from('workspace_member_details')
    .select('id, user_id, role, joined_at, email, display_name, avatar_url, two_factor_enabled')
    .eq('workspace_id', ctx.workspaceId)
    .order('joined_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (search)    membersQ = membersQ.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
  if (roleParam) membersQ = membersQ.eq('role', roleParam)

  if (cursor) {
    try {
      const { joined_at, id } = JSON.parse(Buffer.from(cursor, 'base64').toString())
      membersQ = membersQ.or(`joined_at.gt.${joined_at},and(joined_at.eq.${joined_at},id.gt.${id})`)
    } catch (_) {
      // invalid cursor — ignore, return first page
    }
  }

  const [{ data: rawMembers }, { data: invites, count: inviteCount }] = await Promise.all([
    membersQ,
    supabaseAdmin
      .from('workspace_invites')
      .select('id, email, role, token, created_at, expires_at, invited_by', { count: 'exact' })
      .eq('workspace_id', ctx.workspaceId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  const members = rawMembers || []

  // Safety net: if the owner exists in workspaces but not in this view result,
  // they still have a membership row (auth.js guarantees it), so this is just
  // a dev-time guard that is a no-op in production.
  const hasOwner = members.some(m => m.role === 'owner')
  if (!hasOwner && members.length > 0) {
    console.warn('[members GET] No owner found in member list for workspace', ctx.workspaceId)
  }

  // Sort by role priority
  members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))

  const hasMore = members.length > limit
  if (hasMore) members.pop()

  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ joined_at: members.at(-1).joined_at, id: members.at(-1).id })).toString('base64')
    : null

  return NextResponse.json({
    members,
    invites:      invites || [],
    seatsUsed:    members.length,
    seatLimit:    null,
    pendingCount: inviteCount ?? 0,
    nextCursor,
  })
}

// POST — invite a new member by email
export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!can.inviteMembers(ctx.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, role = 'agent' } = await request.json()
  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!['admin', 'agent', 'observer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()

  // Rate limit: max 20 invites sent from this workspace in the last 60 seconds
  const { count: recentCount } = await supabaseAdmin
    .from('workspace_invites')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId)
    .gt('created_at', new Date(Date.now() - 60_000).toISOString())

  if ((recentCount ?? 0) >= 20) {
    return NextResponse.json({ error: 'Too many invites. Please wait a minute.' }, { status: 429 })
  }

  // Check if already a member (use view for email lookup)
  const { data: existingMember } = await supabaseAdmin
    .from('workspace_member_details')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingMember) return NextResponse.json({ error: 'This person is already a member' }, { status: 400 })

  // Check for existing pending invite and update it, or insert fresh
  const newToken   = randomBytes(32).toString('hex')
  const newExpiry  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: existingInvite } = await supabaseAdmin
    .from('workspace_invites')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('email', normalizedEmail)
    .maybeSingle()

  let invite, inviteError

  if (existingInvite) {
    // Re-invite: reset token, role, expiry, clear prior acceptance
    const { data, error } = await supabaseAdmin
      .from('workspace_invites')
      .update({ role, token: newToken, expires_at: newExpiry, accepted_at: null, invited_by: ctx.user.id })
      .eq('id', existingInvite.id)
      .select()
      .single()
    invite = data
    inviteError = error
  } else {
    const { data, error } = await supabaseAdmin
      .from('workspace_invites')
      .insert({
        workspace_id: ctx.workspaceId,
        email:        normalizedEmail,
        role,
        invited_by:   ctx.user.id,
        token:        newToken,
        expires_at:   newExpiry,
      })
      .select()
      .single()
    invite = data
    inviteError = error
  }

  if (inviteError || !invite) {
    return NextResponse.json({ error: inviteError?.message ?? 'Failed to create invite' }, { status: 500 })
  }

  // Send invite email via Resend (best-effort — failure is surfaced but not fatal)
  let emailSent = false
  let emailError = null
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/invites/${invite.token}`
      await resend.emails.send({
        from:    'Lynq & Flow <noreply@lynqflow.com>',
        to:      normalizedEmail,
        subject: `You've been invited to ${ctx.workspace.name}`,
        html: `
          <p>Hi,</p>
          <p><strong>${ctx.user.email}</strong> has invited you to join <strong>${ctx.workspace.name}</strong> on Lynq &amp; Flow as ${role === 'admin' ? 'an Admin' : role === 'observer' ? 'an Observer' : 'an Agent'}.</p>
          <p><a href="${inviteUrl}" style="background:#A175FC;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
          <p style="color:#9B91A8;font-size:12px;">This link expires in 7 days.</p>
        `,
      })
      emailSent = true
    } catch (err) {
      emailError = err?.message ?? 'Email send failed'
      console.error('[invite] Resend error:', emailError)
    }
  }

  const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/invites/${invite.token}`
  return NextResponse.json({ invite, inviteLink, emailSent, emailError }, { status: 201 })
}
