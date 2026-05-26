import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { acceptTransfer, getPendingTransfer } from '@/lib/services/ownership-transfer'
import { sendTransferAcceptedEmail } from '@/lib/emails/ownership-transfer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Grab transfer details before accepting (for email)
  const transfer = await getPendingTransfer(ctx.workspaceId)

  try {
    await acceptTransfer(ctx.workspaceId, ctx.user.id)

    // Send email to old owner
    if (transfer) {
      const { data: oldOwner } = await supabaseAdmin.auth.admin.getUserById(transfer.from_user_id)
      if (oldOwner?.user?.email) {
        await sendTransferAcceptedEmail({
          to: oldOwner.user.email,
          workspaceName: ctx.workspace.name,
          newOwnerEmail: ctx.user.email ?? '',
          newRoleForOldOwner: transfer.new_role_for_old_owner,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to accept transfer'
    logger.error('[transfer-ownership]', 'accept POST failed', { message })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
