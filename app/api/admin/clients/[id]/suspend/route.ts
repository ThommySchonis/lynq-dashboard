import { supabaseAdmin, getUserFromToken } from '@/lib/supabaseAdmin'
import { sendSuspensionEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { isPlatformAdmin } from '@/lib/platformAdmin'

interface SuspendBody {
  reason?: string
}

interface ClientRow {
  workspace_id: string
  company_name: string
}

interface WorkspaceNameRow {
  name: string | null
}

interface OwnerMemberRow {
  user_id: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserFromToken(token)
  const isAdmin = await isPlatformAdmin(user?.email)
  if (!user || !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: clientId } = await params

  // Resolve workspace_id from the clients table
  const { data: clientRaw } = await supabaseAdmin
    .from('clients')
    .select('workspace_id, company_name')
    .eq('id', clientId)
    .single()

  const client = clientRaw as ClientRow | null

  if (!client?.workspace_id) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const rawBody: unknown = await request.json().catch(() => ({}))
  const body = rawBody as SuspendBody
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
  const { data: workspaceRaw } = await supabaseAdmin
    .from('workspaces')
    .select('name')
    .eq('id', client.workspace_id)
    .single()

  const workspace = workspaceRaw as WorkspaceNameRow | null

  // Find workspace owner from workspace_members (owner_id was removed from workspaces table)
  const { data: ownerMemberRaw } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', client.workspace_id)
    .eq('role', 'owner')
    .single()

  const ownerMember = ownerMemberRaw as OwnerMemberRow | null

  if (ownerMember?.user_id) {
    const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(ownerMember.user_id)
    if (ownerUser?.email) {
      const workspaceName = workspace?.name || client.company_name
      const emailResult = await sendSuspensionEmail({
        to: ownerUser.email,
        workspaceName,
        reason,
      })
      logger.info('[admin/suspend]', 'email status', { status: emailResult.status })
    }
  }

  logger.info('[admin/suspend]', 'workspace suspended', { workspaceId: client.workspace_id, reason })
  return NextResponse.json({ ok: true })
}
