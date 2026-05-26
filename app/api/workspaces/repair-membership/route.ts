import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserFromToken, supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

interface WorkspaceIdRow {
  workspace_id: string
}

interface OwnerMembershipRow {
  id: string
  workspace_id: string
}

interface ProvisionResult {
  workspace_id?: string
}

/**
 * POST /api/workspaces/repair-membership
 *
 * Idempotent self-healing endpoint. Ensures the authenticated user has a
 * workspace + membership row. Called automatically from the Users page when
 * the member list comes back empty (e.g. after first login or a broken
 * provisioning attempt).
 *
 * Returns:
 *   { ok: true, status: 'already_member' | 'repaired' | 'provisioned', workspaceId }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserFromToken(authHeader.replace('Bearer ', ''))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Already has a membership row — nothing to do
  const { data: existing } = await supabaseAdmin
    .from('workspace_members')
    .select('id, workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, status: 'already_member', workspaceId: (existing as WorkspaceIdRow).workspace_id })
  }

  // Owns a workspace but membership row is missing — backfill it
  const { data: ownerMembership } = await supabaseAdmin
    .from('workspace_members')
    .select('id, workspace_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .maybeSingle()

  const typedOwner = ownerMembership as OwnerMembershipRow | null
  if (typedOwner) {
    logger.info('[repair]', 'repaired missing owner membership', { workspaceId: typedOwner.workspace_id })
    return NextResponse.json({ ok: true, status: 'repaired', workspaceId: typedOwner.workspace_id })
  }

  // No workspace at all — provision fresh via RPC
  const workspaceName = (user.user_metadata as Record<string, unknown> | undefined)?.name as string || user.email?.split('@')[0] || 'My Workspace'

  const rpcResponse = await supabaseAdmin
    .rpc('provision_workspace', {
      p_user_id:        user.id,
      p_workspace_name: String(workspaceName),
    })

  const result = rpcResponse.data as ProvisionResult | null
  if (rpcResponse.error || !result?.workspace_id) {
    logger.error('[repair]', 'provision_workspace RPC failed', { message: rpcResponse.error?.message ?? 'no workspace_id returned' })
    return NextResponse.json(
      { error: rpcResponse.error?.message ?? 'Failed to provision workspace' },
      { status: 500 }
    )
  }

  logger.info('[repair]', 'provisioned new workspace', { workspaceId: result.workspace_id })
  return NextResponse.json({ ok: true, status: 'provisioned', workspaceId: result.workspace_id })
}
