import { getAuthContext } from '../../../../lib/auth'
import { sendNewEmail } from '../../../../lib/conversationEngine'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    to?: string[]
    cc?: string[]
    bcc?: string[]
    subject?: string
    bodyHtml?: string
    bodyText?: string
    accountId?: string
  }

  if (!body.to?.length) {
    return NextResponse.json({ error: 'Recipient required' }, { status: 400 })
  }
  if (!body.subject) {
    return NextResponse.json({ error: 'Subject required' }, { status: 400 })
  }
  if (!body.bodyHtml && !body.bodyText) {
    return NextResponse.json({ error: 'Message body required' }, { status: 400 })
  }

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
      accountId = anyAccount.id
    } else {
      accountId = defaultAccount.id
    }
  }

  try {
    const result = await sendNewEmail(ctx.workspaceId, ctx.user.email ?? '', accountId as string, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
    })

    if ('error' in result) {
      return NextResponse.json(result, { status: 429 })
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
