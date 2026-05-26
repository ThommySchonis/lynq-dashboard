import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

const LYNQ_ADMIN_EMAILS = ['info@lynqagency.com']

async function requireLynqAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user) return null
  if (!LYNQ_ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

export async function GET(request: NextRequest) {
  const admin = await requireLynqAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('feedback_submissions')
    .select('id, workspace_id, user_id, type, message, page_url, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    logger.error('[lynq-admin/feedback]', 'query failed', { error: error.message })
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  interface FeedbackRow { id: string; workspace_id: string; user_id: string; type: string; message: string; page_url: string | null; user_agent: string | null; created_at: string }
  interface WorkspaceRow { id: string; name: string }

  // Hydrate workspace + user info. Service-role bypasses RLS.
  const typedRows = rows as FeedbackRow[]
  const userIds = [...new Set(typedRows.map(r => r.user_id))]
  const workspaceIds = [...new Set(typedRows.map(r => r.workspace_id))]

  const [wsResult, usersRes] = await Promise.all([
    supabaseAdmin.from('workspaces').select('id, name').in('id', workspaceIds),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const workspaces = (wsResult.data || []) as WorkspaceRow[]
  const workspaceById = Object.fromEntries(workspaces.map(w => [w.id, w]))
  const userById = Object.fromEntries(
    (usersRes?.data?.users || [])
      .filter(u => userIds.includes(u.id))
      .map(u => [u.id, { id: u.id, email: u.email, name: (u.user_metadata as Record<string, unknown>)?.name || null }])
  )

  // Counts for the last 7 days (used by the sidebar badge).
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const recentCount = typedRows.filter(r => r.created_at > sevenDaysAgo).length

  const submissions = typedRows.map(r => ({
    ...r,
    workspace: workspaceById[r.workspace_id] || null,
    user: userById[r.user_id] || null,
  }))

  return NextResponse.json({ submissions, recentCount })
}
