import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Role } from '@/types/database'
import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { validateBody } from '@/lib/validation'
import { initiateTransferBody } from '@/lib/schemas/ownership-transfer'
import { getPendingTransfer, initiateTransfer } from '@/lib/services/ownership-transfer'
import { sendTransferInitiatedEmail } from '@/lib/emails/ownership-transfer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSiteUrl } from '@/lib/utils/request'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const transfer = await getPendingTransfer(ctx.workspaceId)
  return NextResponse.json({ transfer })
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  if (!can.deleteWorkspace(ctx.role as Role)) {
    return NextResponse.json({ error: 'Only the workspace owner can transfer ownership' }, { status: 403 })
  }

  const [body, bodyErr] = await validateBody(request, initiateTransferBody)
  if (bodyErr) return bodyErr

  try {
    const transfer = await initiateTransfer(
      ctx.workspaceId,
      ctx.user.id,
      body.toUserId,
      body.newRoleForOldOwner,
    )

    // Send email to target member
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(body.toUserId)
    if (targetUser?.user?.email) {
      const siteUrl = getSiteUrl(request)
      await sendTransferInitiatedEmail({
        to: targetUser.user.email,
        workspaceName: ctx.workspace.name,
        ownerEmail: ctx.user.email ?? '',
        dashboardUrl: siteUrl ? `${siteUrl}/settings/workspace/general` : '',
      })
    }

    return NextResponse.json({ transfer }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to initiate transfer'
    logger.error('[transfer-ownership]', 'POST failed', { message })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
