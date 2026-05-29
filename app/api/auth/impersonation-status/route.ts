import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserFromToken } from '@/lib/supabaseAdmin'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ADMIN_EMAILS } from '@/lib/admin-constants'
import type { Workspace } from '@/types/database'

// GET /api/auth/impersonation-status
// Checks if the current user has an active impersonation session via cookie.
// Returns { active: false } or { active: true, workspace, sessionId }.
export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('x-impersonate-session')?.value
  if (!sessionId) {
    return NextResponse.json({ active: false })
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ active: false })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ active: false })
  }

  interface ImpersonationSession {
    id: string
    target_workspace_id: string
  }

  const sessionResult = await supabaseAdmin
    .from('impersonation_sessions')
    .select('id, target_workspace_id')
    .eq('id', sessionId)
    .eq('admin_user_id', user.id)
    .is('ended_at', null)
    .maybeSingle()

  const session = sessionResult.data as ImpersonationSession | null

  if (!session) {
    return NextResponse.json({ active: false })
  }

  const workspaceResult = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('id', session.target_workspace_id)
    .single()

  const workspace = workspaceResult.data as unknown as Workspace

  return NextResponse.json({
    active: true,
    workspace,
    sessionId: session.id,
  })
}
