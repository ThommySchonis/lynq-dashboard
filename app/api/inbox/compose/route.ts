import { getAuthContext, requireWriteAccess } from '@/lib/auth'
import { sendNewEmail } from '@/lib/conversationEngine'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateBody } from '@/lib/validation'
import { composeBody } from '@/lib/schemas/inbox'
import { checkRateLimit } from '@/lib/rate-limit'
import { serviceCatchHandler } from '@/lib/service-catch-handler'

interface EmailAccountId {
  id: string
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = requireWriteAccess(ctx)
  if (blocked) return blocked

  const rl = checkRateLimit(`ws:${ctx.workspaceId}:inbox`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetMs / 1000)),
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  const [body, bodyErr] = await validateBody(request, composeBody)
  if (bodyErr) return bodyErr

  let accountId = body.accountId
  if (!accountId) {
    const { data: defaultAccount } = await supabaseAdmin
      .from('email_accounts')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'active')
      .eq('is_default', true)
      .maybeSingle()

    if (!defaultAccount) {
      const { data: anyAccount } = await supabaseAdmin
        .from('email_accounts')
        .select('id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (!anyAccount) {
        return NextResponse.json({ error: 'No connected email account' }, { status: 400 })
      }
      accountId = (anyAccount as EmailAccountId).id
    } else {
      accountId = (defaultAccount as EmailAccountId).id
    }
  }

  try {
    const result = await sendNewEmail(ctx.workspaceId, ctx.user.email ?? '', accountId as string, {
      to: body.to.map(e => ({ email: e })),
      cc: (body.cc ?? []).map(e => ({ email: e })),
      bcc: (body.bcc ?? []).map(e => ({ email: e })),
      subject: body.subject,
      bodyHtml: body.bodyHtml ?? '',
      bodyText: body.bodyText ?? '',
    })

    if ('error' in result) {
      return NextResponse.json(result, { status: 429 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    return serviceCatchHandler(err, 'gmail')
  }
}
