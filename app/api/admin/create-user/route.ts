import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { getAuthContext } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateBody } from '@/lib/validation'
import { createUserBody } from '@/lib/schemas/admin'

const ADMIN_EMAIL = 'info@lynqagency.com'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve the admin's own workspace_id — new accounts join this workspace.
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [body, err] = await validateBody(request, createUserBody)
  if (err) return err

  const { name, email, password, role } = body

  // Create auth user — auto-confirms, no email verification.
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authError || !authData?.user) {
    return NextResponse.json({ error: authError?.message || 'Failed to create auth user' }, { status: 400 })
  }

  const newUserId = authData.user.id

  // Insert workspace_members row — single source of truth post-refactor.
  const { error: memberError } = await supabaseAdmin
    .from('workspace_members')
    .insert({
      workspace_id: ctx.workspaceId,
      user_id:      newUserId,
      role,
    })

  if (memberError) {
    // Roll back the auth user to avoid orphaned accounts.
    await supabaseAdmin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Best-effort: stamp user_profiles with the provided display_name so the
  // team list renders the chosen name immediately (not the email-prefix
  // fallback). Failures are non-fatal — name falls back to email-prefix.
  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .upsert(
      { user_id: newUserId, display_name: name.trim() },
      { onConflict: 'user_id' },
    )
  if (profileError) {
    console.warn('[admin/create-user] user_profiles upsert failed (non-fatal):', profileError.message)
  }

  return NextResponse.json({ ok: true, userId: newUserId })
}
