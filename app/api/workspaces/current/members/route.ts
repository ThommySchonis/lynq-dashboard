import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { randomBytes } from 'node:crypto'
import { getAuthContext } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendInviteEmail } from '@/lib/email'
import { validateBody, validateQuery } from '@/lib/validation'
import { getMembersQuery, inviteMemberBody } from '@/lib/schemas/workspaces'

interface CursorPayload {
  joined_at: string
  id: string
}

interface IdRow {
  id: string
}

const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, agent: 2, observer: 3 }

// Derive the site URL from env first, fall back to the incoming request.
// Avoids broken invite links when NEXT_PUBLIC_SITE_URL isn't set on Vercel.
function getSiteUrl(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const host  = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : ''
}

// GET — list workspace members + pending invites
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [query, queryErr] = validateQuery(request, getMembersQuery)
  if (queryErr) return queryErr

  const search    = query.q?.trim().toLowerCase() || ''
  const roleParam = query.role || ''
  const cursor    = query.cursor || null
  const limit     = Math.min(query.limit ?? 50, 100)

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
      const { joined_at, id } = JSON.parse(Buffer.from(cursor, 'base64').toString()) as CursorPayload
      membersQ = membersQ.or(`joined_at.gt.${joined_at},and(joined_at.eq.${joined_at},id.gt.${id})`)
    } catch {
      // invalid cursor — ignore
    }
  }

  const [
    { data: rawMembers, error: membersError },
    { data: invites, count: inviteCount, error: invitesError },
  ] = await Promise.all([
    membersQ,
    supabaseAdmin
      .from('workspace_invite_details')
      .select('id, email, role, token, created_at, sent_at, expires_at, invited_by, inviter_email, inviter_name', { count: 'exact' })
      .eq('workspace_id', ctx.workspaceId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ])

  if (membersError) console.error('[members GET] members query failed:', membersError.message)
  if (invitesError) console.error('[members GET] invites query failed:', invitesError.message)

  interface MemberViewRow { id: string; role: string; joined_at: string; [key: string]: unknown }
  const members = (rawMembers || []) as MemberViewRow[]
  members.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99))

  const hasMore = members.length > limit
  if (hasMore) members.pop()

  const lastMember = members.at(-1)
  const nextCursor = hasMore && lastMember
    ? Buffer.from(JSON.stringify({ joined_at: lastMember.joined_at, id: lastMember.id })).toString('base64')
    : null

  // Attach the invite link to each pending invite for the UI's copy button
  interface InviteViewRow { id: string; email: string; role: string; token: string; created_at: string; sent_at: string | null; expires_at: string; invited_by: string; inviter_email: string | null; inviter_name: string | null }
  const siteUrl = getSiteUrl(request)
  const typedInvites = (invites || []) as InviteViewRow[]
  const invitesWithLinks = typedInvites.map(i => ({
    ...i,
    inviteLink: siteUrl ? `${siteUrl}/invites/${i.token}` : null,
  }))

  const isOwner = ctx.workspace?.owner_id === ctx.user.id

  if (!ctx.role) {
    console.warn('[members GET] ctx.role missing!', {
      userId:      ctx.user?.id,
      workspaceId: ctx.workspaceId,
      memberId:    ctx.memberId,
    })
  }

  console.log('[members GET]', {
    workspaceId: ctx.workspaceId,
    userId:      ctx.user.id,
    role:        ctx.role,
    isOwner,
    memberCount: members.length,
  })

  return NextResponse.json({
    members,
    invites:         invitesWithLinks,
    currentUserRole: ctx.role ?? null,
    isOwner,
    workspaceName:   ctx.workspace?.name ?? null,
    seatsUsed:       members.length,
    seatLimit:       null,
    pendingCount:    inviteCount ?? 0,
    nextCursor,
  })
}

// POST — invite a new member by email
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) {
    console.error('[invite POST] no auth context')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!can.inviteMembers(ctx.role as Role)) {
    console.error('[invite POST] role', ctx.role, 'cannot invite members')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [body, bodyErr] = await validateBody(request, inviteMemberBody)
  if (bodyErr) return bodyErr

  const { email, role } = body
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
    console.error('[invite POST] existing invite check failed:', existingInviteError.message)
    return NextResponse.json({ error: existingInviteError.message, code: 'lookup_failed' }, { status: 500 })
  }

  const newToken  = randomBytes(32).toString('hex')
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const nowIso    = new Date().toISOString()

  interface InviteRow { id: string; token: string; [key: string]: unknown }
  let invite: InviteRow
  if (existingInvite) {
    console.log('[invite POST] refreshing pending invite', (existingInvite as IdRow).id)
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
      console.error('[invite POST] update failed:', updateResult.error?.message)
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
    console.log('[invite POST] creating new invite')
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
      console.error('[invite POST] insert failed:', insertResult.error?.message)
      return NextResponse.json({ error: insertResult.error?.message ?? 'Failed to create invite' }, { status: 500 })
    }
    invite = insertResult.data as InviteRow
  }

  console.log('[invite POST] invite saved, id:', invite.id, 'token length:', invite.token?.length)

  const siteUrl    = getSiteUrl(request)
  const inviteLink = siteUrl ? `${siteUrl}/invites/${invite.token}` : null

  if (!siteUrl) {
    console.error('[invite POST] could not determine site URL — invite link unavailable')
  }

  // Send invite email via shared helper
  const emailResult = await sendInviteEmail({
    to:            normalizedEmail,
    workspaceName: ctx.workspace.name,
    inviterEmail:  ctx.user.email ?? '',
    role,
    link:          inviteLink,
  })

  console.log('[invite POST] email result:', emailResult.status)

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
