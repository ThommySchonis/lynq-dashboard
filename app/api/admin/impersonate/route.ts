import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { validateBody } from '@/lib/validation'
import { startImpersonationBody } from '@/lib/schemas/admin'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ADMIN_EMAILS } from '@/lib/admin-constants'
import { logger } from '@/lib/logger'

// POST /api/admin/impersonate — start impersonation session
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAILS.includes(ctx.user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [body, bErr] = await validateBody(request, startImpersonationBody)
  if (bErr) return bErr

  const { workspaceId } = body

  // Verify workspace exists
  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .maybeSingle()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  // End any existing active session for this admin
  await supabaseAdmin
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('admin_user_id', ctx.user.id)
    .is('ended_at', null)

  // Create new session
  const { data: sessionData, error } = await supabaseAdmin
    .from('impersonation_sessions')
    .insert({
      admin_user_id: ctx.user.id,
      target_workspace_id: workspaceId,
    })
    .select('id')
    .single()

  const session = sessionData as { id: string } | null

  if (error || !session) {
    logger.error('[impersonate]', 'failed to create session', { error: error?.message })
    return NextResponse.json({ error: 'Failed to start impersonation' }, { status: 500 })
  }

  logger.info('[impersonate]', 'session started', {
    adminId: ctx.user.id,
    targetWorkspaceId: workspaceId,
    sessionId: session.id,
  })

  // Set httpOnly cookie and return
  const response = NextResponse.json({ sessionId: session.id })
  response.cookies.set('x-impersonate-session', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 28800, // 8 hours
  })
  return response
}

// DELETE /api/admin/impersonate — end impersonation session
export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADMIN_EMAILS.includes(ctx.user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sessionId = request.cookies.get('x-impersonate-session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'No active impersonation session' }, { status: 404 })
  }

  // End the session
  const { error } = await supabaseAdmin
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('admin_user_id', ctx.user.id)
    .is('ended_at', null)

  if (error) {
    logger.error('[impersonate]', 'failed to end session', { error: error.message })
  }

  logger.info('[impersonate]', 'session ended', {
    adminId: ctx.user.id,
    sessionId,
  })

  // Clear cookie and return
  const response = NextResponse.json({ redirect: '/admin/clients' })
  response.cookies.set('x-impersonate-session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return response
}
