import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin'

function sanitizeName(raw) {
  if (typeof raw !== 'string') return ''
  // Strip control chars + collapse whitespace + trim + cap to 100
  return raw
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

// POST — public: signup-via-invite. Creates a Supabase auth user using the
// invite's locked email, then accepts the invite. The frontend signs the
// user in client-side using the password they just typed.
export async function POST(request, { params }) {
  const { token } = await params

  const body = await request.json().catch(() => ({}))
  const { full_name, password } = body

  const cleanName = sanitizeName(full_name)
  if (!cleanName) {
    return NextResponse.json({ error: 'Full name is required', code: 'name_required' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters', code: 'weak_password' }, { status: 400 })
  }

  // Lookup + validate invite (re-validation: prevents stale-page exploits)
  const { data: invite, error: lookupError } = await supabaseAdmin
    .from('workspace_invites')
    .select('id, workspace_id, email, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (lookupError) {
    console.error('[invite signup] lookup failed:', lookupError.message)
    return NextResponse.json({ error: 'Lookup failed', code: 'lookup_failed' }, { status: 500 })
  }
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found', code: 'not_found' }, { status: 404 })
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: 'This invite has already been accepted', code: 'already_accepted' }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite has expired', code: 'expired' }, { status: 410 })
  }

  // Create the auth user with email pre-confirmed (skip Supabase confirm-email)
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email:         invite.email,
    password,
    email_confirm: true,
    user_metadata: { name: cleanName },
  })

  if (createError) {
    const msg = createError.message || ''
    // Supabase returns a 422 with phrasing like "User already registered" or
    // "A user with this email address has already been registered"
    if (/already (registered|exists)|email.+already/i.test(msg)) {
      return NextResponse.json(
        {
          error: 'An account already exists for this email. Sign in instead.',
          code:  'email_exists',
        },
        { status: 409 }
      )
    }
    if (/password/i.test(msg)) {
      return NextResponse.json({ error: msg, code: 'weak_password' }, { status: 400 })
    }
    console.error('[invite signup] createUser failed:', msg)
    return NextResponse.json({ error: msg || 'Signup failed', code: 'signup_failed' }, { status: 500 })
  }

  const newUserId = created?.user?.id
  if (!newUserId) {
    console.error('[invite signup] createUser returned no user id')
    return NextResponse.json({ error: 'Signup failed', code: 'signup_failed' }, { status: 500 })
  }

  // Accept the invite atomically via the existing RPC
  const { data: acceptResult, error: rpcError } = await supabaseAdmin.rpc('accept_workspace_invite', {
    p_token:   token,
    p_user_id: newUserId,
  })

  if (rpcError) {
    console.error('[invite signup] accept RPC failed:', rpcError.message)
    return NextResponse.json({ error: rpcError.message, code: 'accept_failed' }, { status: 500 })
  }
  if (!acceptResult?.ok) {
    console.error('[invite signup] accept RPC returned non-ok:', JSON.stringify(acceptResult))
    return NextResponse.json(
      { error: acceptResult?.error ?? 'Failed to accept invite', code: 'accept_failed' },
      { status: 500 }
    )
  }

  console.log('[invite signup] success — user', newUserId, 'joined workspace', invite.workspace_id)

  return NextResponse.json({
    ok:           true,
    workspace_id: invite.workspace_id,
    email:        invite.email,
  })
}
