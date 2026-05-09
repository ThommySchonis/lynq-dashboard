import { getAuthContext } from '../../../../lib/auth'
import { sendNewEmail } from '../../../../lib/conversationEngine'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

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
    const result = await sendNewEmail(ctx.workspaceId, ctx.user.email, accountId, {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
    })

    if (result.error) {
      return NextResponse.json(result, { status: 429 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
