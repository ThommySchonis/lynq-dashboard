import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { cancelSubscription } from '@/lib/services/billing'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  if (!can.deleteWorkspace(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only the workspace owner can delete a workspace' }, { status: 403 })
  }

  try {
    // Cancel Whop subscription if active
    try {
      await cancelSubscription(ctx.workspaceId, false)
    } catch {
      // Subscription may not exist or already cancelled
    }

    // Schedule workspace deletion (7 days)
    const scheduledFor = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error } = await supabaseAdmin
      .from('workspaces')
      .update({ scheduled_for_deletion_at: scheduledFor })
      .eq('id', ctx.workspaceId)

    if (error) throw new Error(`Failed to schedule deletion: ${error.message}`)

    // Log to workspace_deletion_log
    await supabaseAdmin.from('workspace_deletion_log').insert({
      workspace_id: ctx.workspaceId,
      event: 'scheduled',
      snapshot: {
        workspace_name: ctx.workspace.name,
        owner_id: ctx.user.id,
        scheduled_for: scheduledFor,
      },
    })

    return NextResponse.json({ scheduledFor })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to schedule workspace deletion'
    logger.error('[delete]', 'workspace delete POST failed', { message })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
