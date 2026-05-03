import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getAuthContext } from '../../../../../lib/auth'
import { can } from '../../../../../lib/permissions'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

const ROLE_ORDER = { owner: 0, admin: 1, agent: 2, observer: 3 }

// Derive the site URL from env first, fall back to the incoming request.
// Avoids broken invite links when NEXT_PUBLIC_SITE_URL isn't set on Vercel.
function getSiteUrl(request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const host  = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : ''
}

// GET — list workspace members + pending invites
export async function GET(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search    = searchParams.get('q')?.trim().toLowerCase() || ''
  const roleParam = searchParams.get('role') || ''
  const cursor    = searchParams.get('cursor') || null
  const limit     = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

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
      // invalid cursor — ignore
    }
  }

  const [
    { data: rawMembers, error: membersError },
    { data: invites, count: inviteCount, error: invitesError },
  ] = await Promise.all([
    membersQ,
    supabaseAdmin
      .from('workspace_invites')
      .select('id, email, role, token, created_at, expires_at, invited_by', { count: 'exact' })
      .eq('workspace_id', ctx.workspaceId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  if (membersError) console.error('[members GET] members query failed:', membersError.message)
  if (invitesError) console.error('[members GET] invites query failed:', invitesError.message)

  const members = rawMembers || []
  members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))

  const hasMore = members.length > limit
  if (hasMore) members.pop()

  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ joined_at: members.at(-1).joined_at, id: members.at(-1).id })).toString('base64')
    : null

  // Attach the invite link to each pending invite for the UI's copy button
  const siteUrl = getSiteUrl(request)
  const invitesWithLinks = (invites || []).map(i => ({
    ...i,
    inviteLink: siteUrl ? `${siteUrl}/invites/${i.token}` : null,
  }))

  return NextResponse.json({
    members,
    invites:      invitesWithLinks,
    seatsUsed:    members.length,
    seatLimit:    null,
    pendingCount: inviteCount ?? 0,
    nextCursor,
  })
}

// POST — invite a new member by email
export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    console.error('[invite POST] no auth context')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!can.inviteMembers(ctx.role)) {
    console.error('[invite POST] role', ctx.role, 'cannot invite members')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { email, role = 'agent' } = body

  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  if (!['admin', 'agent', 'observer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()
  console.log('[invite POST] starting invite for', normalizedEmail, 'role:', role, 'workspace:', ctx.workspaceId)

  // Rate limit: max 20 invites in last 60s
  const { count: recentCount, error: rateError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId)
    .gt('created_at', new Date(Date.now() - 60_000).toISOString())

  if (rateError) console.error('[invite POST] rate-limit query failed:', rateError.message)
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
    console.error('[invite POST] existing member check failed:', memberError.message)
    return NextResponse.json({ error: `Member lookup failed: ${memberError.message}` }, { status: 500 })
  }
  if (existingMember) {
    return NextResponse.json({ error: 'This person is already a member' }, { status: 400 })
  }

  // Existing invite check — only consider non-accepted invites
  const newToken  = randomBytes(32).toString('hex')
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: existingInvite, error: existingInviteError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingInviteError) {
    console.error('[invite POST] existing invite check failed:', existingInviteError.message)
  }

  let invite, inviteError

  if (existingInvite) {
    console.log('[invite POST] re-inviting (existing invite id:', existingInvite.id, ')')
    const { data, error } = await supabaseAdmin
      .from('workspace_invites')
      .update({ role, token: newToken, expires_at: newExpiry, accepted_at: null, invited_by: ctx.user.id })
      .eq('id', existingInvite.id)
      .select()
      .single()
    invite = data
    inviteError = error
  } else {
    console.log('[invite POST] creating new invite')
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
    console.error('[invite POST] insert/update failed:', inviteError?.message)
    return NextResponse.json({ error: inviteError?.message ?? 'Failed to create invite' }, { status: 500 })
  }

  console.log('[invite POST] invite saved, id:', invite.id, 'token length:', invite.token?.length)

  const siteUrl    = getSiteUrl(request)
  const inviteLink = siteUrl ? `${siteUrl}/invites/${invite.token}` : null

  if (!siteUrl) {
    console.error('[invite POST] could not determine site URL — invite link unavailable')
  }

  // Send invite email — best-effort, surfaces clear status to the UI
  let emailStatus = 'skipped'
  let emailError  = null

  if (!process.env.RESEND_API_KEY) {
    emailStatus = 'not_configured'
    console.warn('[invite POST] RESEND_API_KEY not set — skipping email send')
  } else if (!inviteLink) {
    emailStatus = 'no_link'
  } else {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const roleLabel = role === 'admin' ? 'an Admin' : role === 'observer' ? 'an Observer' : 'an Agent'
      await resend.emails.send({
        from:    'Lynq & Flow <noreply@lynqflow.com>',
        to:      normalizedEmail,
        subject: `You've been invited to ${ctx.workspace.name}`,
        html: `
          <p>Hi,</p>
          <p><strong>${ctx.user.email}</strong> has invited you to join <strong>${ctx.workspace.name}</strong> on Lynq &amp; Flow as ${roleLabel}.</p>
          <p><a href="${inviteLink}" style="background:#A175FC;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
          <p style="color:#9B91A8;font-size:12px;">This link expires in 7 days.</p>
        `,
      })
      emailStatus = 'sent'
      console.log('[invite POST] email sent via Resend')
    } catch (err) {
      emailStatus = 'failed'
      emailError  = err?.message ?? 'Email send failed'
      console.error('[invite POST] Resend error:', emailError)
    }
  }

  return NextResponse.json(
    { invite, inviteLink, emailStatus, emailError },
    { status: 201 }
  )
}
