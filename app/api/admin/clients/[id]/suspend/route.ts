import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { sendSuspensionEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

const ADMIN_EMAILS = ['info@lynqagency.com', 'denver9523@gmail.com']

interface SuspendBody {
  reason?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: clientId } = await params

  // Resolve workspace_id from the clients table
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('workspace_id, company_name')
    .eq('id', clientId)
    .single()

  if (!client?.workspace_id) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as SuspendBody
  const reason = body.reason?.trim() || null

  // Set suspension
  const { error } = await supabaseAdmin
    .from('workspaces')
    .update({
      suspended_at: new Date().toISOString(),
      suspension_reason: reason,
    })
    .eq('id', client.workspace_id)

  if (error) {
    logger.error('[admin/suspend]', 'update failed', { error: error.message })
    return NextResponse.json({ error: 'Failed to suspend workspace' }, { status: 500 })
  }

  // Send email to workspace owner
  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('name')
    .eq('id', client.workspace_id)
    .single()

  // Find workspace owner from workspace_members (owner_id was removed from workspaces table)
  const { data: ownerMember } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', client.workspace_id)
    .eq('role', 'owner')
    .single()

  if (ownerMember?.user_id) {
    const userId = ownerMember.user_id as string
    const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (ownerUser?.email) {
      const workspaceName = (workspace?.name as string | undefined) || (client.company_name as string)
      const emailResult = await sendSuspensionEmail({
        to: ownerUser.email,
        workspaceName,
        reason,
      })
      logger.info('[admin/suspend]', 'email status', { status: emailResult.status })
    }
  }

  logger.info('[admin/suspend]', 'workspace suspended', { workspaceId: String(client.workspace_id), reason })
  return NextResponse.json({ ok: true })
}
